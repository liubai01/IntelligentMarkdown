/**
 * Lua file linker
 * Manages association between Markdown config blocks and Lua files
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import { ParsedConfigBlock } from '../../types';
import { LuaParser } from '../parser/luaParser';
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
    tableData?: Array<{ data: Record<string, any>; ranges: Record<string, [number, number]> }>;
  };
  /** Link status */
  linkStatus: 'ok' | 'file-not-found' | 'key-not-found' | 'parse-error';
  /** Error message */
  linkError?: string;
}

export class LuaLinker {
  private pathResolver: PathResolver;
  private luaFileCache: Map<string, { content: string; parser: LuaParser; mtime: number }>;

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
    // Resolve Lua file path
    const absolutePath = this.pathResolver.resolve(baseDir, block.file);

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
      // Get or create parser
      const parser = await this.getParser(absolutePath);

      // Choose find method based on type
      const result = block.type === 'code'
        ? parser.findFunctionByFullPath(block.key)
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

      // For table type, extract detailed table array data (needs raw AST node)
      if (block.type === 'table' && result.astNode && result.astNode.type === 'TableConstructorExpression') {
        const tableData = parser.extractTableArray(result.astNode);
        if (tableData) {
          linkedBlock.luaNode.tableData = tableData;
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
  private async getParser(filePath: string): Promise<LuaParser> {
    const stats = fs.statSync(filePath);
    const mtime = stats.mtimeMs;

    // Check cache
    const cached = this.luaFileCache.get(filePath);
    if (cached && cached.mtime === mtime) {
      return cached.parser;
    }

    // Read and parse file
    const content = fs.readFileSync(filePath, 'utf-8');
    const parser = new LuaParser(content);

    // Update cache
    this.luaFileCache.set(filePath, { content, parser, mtime });

    return parser;
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
