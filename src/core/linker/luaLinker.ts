/**
 * Lua 文件链接器
 * 管理 Markdown 配置块与 Lua 文件的关联
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import { ParsedConfigBlock } from '../../types';
import { LuaParser } from '../parser/luaParser';
import { PathResolver } from './pathResolver';

export interface LinkedConfigBlock extends ParsedConfigBlock {
  /** 解析后的绝对文件路径 */
  absoluteFilePath: string;
  /** 当前从 Lua 读取的值 */
  currentValue: any;
  /** Lua 值节点信息 */
  luaNode?: {
    range: [number, number];
    loc: {
      start: { line: number; column: number };
      end: { line: number; column: number };
    };
    /** table 类型的详细数据（包含每个字段的 range） */
    tableData?: Array<{ data: Record<string, any>; ranges: Record<string, [number, number]> }>;
  };
  /** 链接状态 */
  linkStatus: 'ok' | 'file-not-found' | 'key-not-found' | 'parse-error';
  /** 错误信息 */
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
   * 链接配置块到 Lua 文件
   * @param blocks 解析出的配置块
   * @param markdownPath Markdown 文件路径
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
   * 链接单个配置块
   */
  private async linkSingleBlock(block: ParsedConfigBlock, baseDir: string): Promise<LinkedConfigBlock> {
    // 解析 Lua 文件路径
    const absolutePath = this.pathResolver.resolve(baseDir, block.file);

    // 创建基础链接块
    const linkedBlock: LinkedConfigBlock = {
      ...block,
      absoluteFilePath: absolutePath,
      currentValue: undefined,
      linkStatus: 'ok'
    };

    // 检查文件是否存在
    if (!fs.existsSync(absolutePath)) {
      linkedBlock.linkStatus = 'file-not-found';
      linkedBlock.linkError = `文件不存在: ${absolutePath}`;
      return linkedBlock;
    }

    try {
      // 获取或创建解析器
      const parser = await this.getParser(absolutePath);

      // 根据类型选择查找方法
      const result = block.type === 'code'
        ? parser.findFunctionByFullPath(block.key)
        : parser.findNodeByPath(block.key);

      if (!result.success || !result.node) {
        linkedBlock.linkStatus = 'key-not-found';
        linkedBlock.linkError = result.error || `找不到变量: ${block.key}`;
        return linkedBlock;
      }

      // 填充值和位置信息
      // code 类型使用 raw 源码文本，其他类型使用解析后的值
      linkedBlock.currentValue = block.type === 'code'
        ? (result.node.raw || '')
        : result.node.value;
      linkedBlock.luaNode = {
        range: result.node.range,
        loc: result.node.loc
      };

      // 如果是 table 类型，提取详细的表格数组数据（需要原始 AST 节点）
      if (block.type === 'table' && result.astNode && result.astNode.type === 'TableConstructorExpression') {
        const tableData = parser.extractTableArray(result.astNode);
        if (tableData) {
          linkedBlock.luaNode.tableData = tableData;
        }
      }

      linkedBlock.linkStatus = 'ok';

    } catch (error) {
      linkedBlock.linkStatus = 'parse-error';
      linkedBlock.linkError = `解析错误: ${error instanceof Error ? error.message : String(error)}`;
    }

    return linkedBlock;
  }

  /**
   * 获取 Lua 文件的解析器（带缓存）
   */
  private async getParser(filePath: string): Promise<LuaParser> {
    const stats = fs.statSync(filePath);
    const mtime = stats.mtimeMs;

    // 检查缓存
    const cached = this.luaFileCache.get(filePath);
    if (cached && cached.mtime === mtime) {
      return cached.parser;
    }

    // 读取并解析文件
    const content = fs.readFileSync(filePath, 'utf-8');
    const parser = new LuaParser(content);

    // 更新缓存
    this.luaFileCache.set(filePath, { content, parser, mtime });

    return parser;
  }

  /**
   * 清除缓存
   */
  clearCache(filePath?: string): void {
    if (filePath) {
      this.luaFileCache.delete(filePath);
    } else {
      this.luaFileCache.clear();
    }
  }

  /**
   * 刷新指定文件的缓存
   */
  async refreshCache(filePath: string): Promise<void> {
    this.clearCache(filePath);
    if (fs.existsSync(filePath)) {
      await this.getParser(filePath);
    }
  }

  /**
   * 获取 Lua 文件中变量的位置（用于跳转）
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
