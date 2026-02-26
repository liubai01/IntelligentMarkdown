/**
 * Lua file linker
 * Manages association between Markdown config blocks and Lua files
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import { ParsedConfigBlock } from '../../types';
import { LuaParser } from '../parser/luaParser';
import { JsonParser } from '../parser/jsonParser';
import { ExcelParser } from '../parser/excelParser';
import { PathResolver } from './pathResolver';

export interface LinkedConfigBlock extends ParsedConfigBlock {
  /** Parsed absolute file path */
  absoluteFilePath: string;
  /** Current value read from Lua */
  currentValue: any;
  /** Lua value node info */
  luaNode?: {
    range: [number, number];
    loc: {
      start: { line: number; column: number };
      end: { line: number; column: number };
    };
    /** Table type detailed data (includes range for each field) */
    tableData?: Array<{
      data: Record<string, any>;
      ranges: Record<string, [number, number]>;
      rowLoc?: { start: { line: number; column: number }; end: { line: number; column: number } };
    }>;
  };
  /** Link status */
  linkStatus: 'ok' | 'file-not-found' | 'key-not-found' | 'parse-error';
  /** Error message */
  linkError?: string;
}

export class LuaLinker {
  private static readonly MAX_TABLE_ROWS_CAP = 1000;
  private pathResolver: PathResolver;
  private luaFileCache: Map<string, {
    content: string;
    parser: LuaParser | JsonParser | ExcelParser;
    mtime: number;
    format: 'lua' | 'json' | 'excel';
  }>;

  constructor() {
    this.pathResolver = new PathResolver();
    this.luaFileCache = new Map();
  }

  /**
   * Link config blocks to Lua files
   * @param blocks Parsed config blocks
   * @param markdownPath Markdown file path
   */
  async linkBlocks(blocks: ParsedConfigBlock[], markdownPath: string): Promise<LinkedConfigBlock[]> {
    const markdownDir = this.pathResolver.dirname(markdownPath);
    const linkedBlocks: LinkedConfigBlock[] = [];

    for (const block of blocks) {
      const linkedBlock = await this.linkSingleBlock(block, markdownDir);
      linkedBlocks.push(linkedBlock);
    }

    return linkedBlocks;
  }

  /**
   * Link a single config block
   */
  private async linkSingleBlock(block: ParsedConfigBlock, baseDir: string): Promise<LinkedConfigBlock> {
    const storage = block.storage === 'markdown' ? 'markdown' : 'source';
    if (storage === 'markdown') {
      return {
        ...block,
        absoluteFilePath: '',
        currentValue: block.value !== undefined ? block.value : block.default,
        linkStatus: 'ok'
      };
    }

    // Resolve source file path
    const absolutePath = this.pathResolver.resolve(baseDir, block.file || '');
    const isJsonFile = /\.(json|jsonc)$/i.test(absolutePath);
    const isExcelFile = /\.(xlsx|xlsm|xlsb|xls)$/i.test(absolutePath);
    const isTableType = block.type === 'table';

    // Create base linked block
    const linkedBlock: LinkedConfigBlock = {
      ...block,
      absoluteFilePath: absolutePath,
      currentValue: undefined,
      linkStatus: 'ok'
    };

    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      linkedBlock.linkStatus = 'file-not-found';
      linkedBlock.linkError = vscode.l10n.t('File not found: {0}', absolutePath);
      return linkedBlock;
    }

    try {
      // JSON/Excel code editor is postponed to a later phase
      if ((isJsonFile || isExcelFile) && block.type === 'code') {
        linkedBlock.linkStatus = 'parse-error';
        linkedBlock.linkError = vscode.l10n.t('Type "{0}" is not supported for this source format yet', block.type);
        return linkedBlock;
      }

      if (isExcelFile && !isTableType) {
        linkedBlock.linkStatus = 'parse-error';
        linkedBlock.linkError = vscode.l10n.t('Excel source currently supports only table type');
        return linkedBlock;
      }

      // Get or create parser
      const parserInfo = await this.getParser(absolutePath);
      const parser = parserInfo.parser;
      const tableReadOptions = this.resolveTableReadOptions(block.maxRows, block.tailRows);

      // Choose find method based on type
      const result = !isJsonFile && !isExcelFile && block.type === 'code'
        ? (parser as LuaParser).findFunctionByFullPath(block.key)
        : isExcelFile
          ? (parser as ExcelParser).findNodeByPath(block.key, tableReadOptions)
          : parser.findNodeByPath(block.key);

      if (!result.success || !result.node) {
        linkedBlock.linkStatus = 'key-not-found';
        linkedBlock.linkError = result.error || vscode.l10n.t('Variable not found: {0}', block.key);
        return linkedBlock;
      }

      // Populate value and location info
      // code type uses raw source text, other types use parsed value
      linkedBlock.currentValue = block.type === 'code'
        ? (result.node.raw || '')
        : result.node.value;
      linkedBlock.luaNode = {
        range: result.node.range,
        loc: result.node.loc
      };

      // For Lua table type, extract detailed table array data (needs raw AST node)
      if (!isJsonFile && block.type === 'table' && result.astNode && result.astNode.type === 'TableConstructorExpression') {
        const luaParser = parser as LuaParser;
        const tableData = luaParser.extractTableArray(result.astNode);
        if (tableData) {
          linkedBlock.luaNode.tableData = tableData;
        }
      }

      if (isJsonFile && block.type === 'table' && result.astNode) {
        const jsonParser = parser as JsonParser;
        const tableData = jsonParser.extractTableArray(result.astNode);
        if (tableData) {
          linkedBlock.luaNode.tableData = tableData;
        } else {
          linkedBlock.linkStatus = 'parse-error';
          linkedBlock.linkError = vscode.l10n.t('JSON table editor requires an array of objects');
          return linkedBlock;
        }
      }

      if (isExcelFile && block.type === 'table' && result.astNode) {
        const excelParser = parser as ExcelParser;
        const tableData = excelParser.extractTableArray(result.astNode);
        if (tableData) {
          linkedBlock.luaNode.tableData = tableData as any;
          linkedBlock.currentValue = tableData.map(row => row.data);
        } else {
          linkedBlock.linkStatus = 'parse-error';
          linkedBlock.linkError = vscode.l10n.t('Excel table editor requires a worksheet with header row');
          return linkedBlock;
        }
      }

      linkedBlock.linkStatus = 'ok';

    } catch (error) {
      linkedBlock.linkStatus = 'parse-error';
      linkedBlock.linkError = vscode.l10n.t('Parse error: {0}', error instanceof Error ? error.message : String(error));
    }

    return linkedBlock;
  }

  /**
   * Get Lua file parser (with cache)
   */
  private async getParser(filePath: string): Promise<{
    parser: LuaParser | JsonParser | ExcelParser;
    format: 'lua' | 'json' | 'excel';
  }> {
    const stats = fs.statSync(filePath);
    const mtime = stats.mtimeMs;
    const format: 'lua' | 'json' | 'excel' = /\.(json|jsonc)$/i.test(filePath)
      ? 'json'
      : /\.(xlsx|xlsm|xlsb|xls)$/i.test(filePath)
        ? 'excel'
        : 'lua';

    // Check cache
    const cached = this.luaFileCache.get(filePath);
    if (cached && cached.mtime === mtime && cached.format === format) {
      return { parser: cached.parser, format: cached.format };
    }

    // Read and parse file
    const content = format === 'excel'
      ? ''
      : fs.readFileSync(filePath, 'utf-8');
    const parser = format === 'json'
      ? new JsonParser(content)
      : format === 'excel'
        ? new ExcelParser(filePath)
        : new LuaParser(content);

    // Update cache
    this.luaFileCache.set(filePath, { content, parser, mtime, format });

    return { parser, format };
  }

  private resolveTableReadOptions(maxRows?: number, tailRows?: number): { maxRows?: number; tailRows?: number } {
    const normalizedMaxRows = Number.isInteger(maxRows) && (maxRows as number) > 0
      ? Math.min(maxRows as number, LuaLinker.MAX_TABLE_ROWS_CAP)
      : undefined;
    const normalizedTailRows = Number.isInteger(tailRows) && (tailRows as number) > 0
      ? (tailRows as number)
      : undefined;
    return {
      maxRows: normalizedMaxRows,
      tailRows: normalizedTailRows
    };
  }

  /**
   * Clear cache
   */
  clearCache(filePath?: string): void {
    if (filePath) {
      this.luaFileCache.delete(filePath);
    } else {
      this.luaFileCache.clear();
    }
  }

  /**
   * Refresh cache for a specific file
   */
  async refreshCache(filePath: string): Promise<void> {
    this.clearCache(filePath);
    if (fs.existsSync(filePath)) {
      await this.getParser(filePath);
    }
  }

  /**
   * Get variable location in Lua file (for navigation)
   */
  getVariableLocation(linkedBlock: LinkedConfigBlock): vscode.Location | null {
    if (linkedBlock.linkStatus !== 'ok' || !linkedBlock.luaNode) {
      return null;
    }

    const uri = vscode.Uri.file(linkedBlock.absoluteFilePath);
    const position = new vscode.Position(
      linkedBlock.luaNode.loc.start.line - 1,
      linkedBlock.luaNode.loc.start.column
    );

    return new vscode.Location(uri, position);
  }
}
