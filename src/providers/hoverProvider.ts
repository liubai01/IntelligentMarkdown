/**
 * 悬停提示提供者
 * 在 Markdown 的 lua-config 代码块上显示当前 Lua 变量的值
 */

import * as vscode from 'vscode';
import { ConfigBlockParser } from '../core/parser/configBlockParser';
import { LuaLinker } from '../core/linker/luaLinker';

export class LuaConfigHoverProvider implements vscode.HoverProvider {
  private configParser: ConfigBlockParser;
  private luaLinker: LuaLinker;

  constructor() {
    this.configParser = new ConfigBlockParser();
    this.luaLinker = new LuaLinker();
  }

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    if (token.isCancellationRequested) {
      return null;
    }

    const text = document.getText();
    const blocks = this.configParser.parseMarkdown(text);

    // 查找位置所在的配置块
    const currentBlock = blocks.find(block =>
      position.line >= block.startLine - 1 && position.line <= block.endLine - 1
    );

    if (!currentBlock) {
      return null;
    }

    // 链接到 Lua 文件获取值
    const linkedBlocks = await this.luaLinker.linkBlocks([currentBlock], document.uri.fsPath);
    const linkedBlock = linkedBlocks[0];

    if (!linkedBlock) {
      return null;
    }

    // 构建悬停内容
    const contents = new vscode.MarkdownString();
    contents.isTrusted = true;

    // 标题
    contents.appendMarkdown(`### 🔗 Lua 配置绑定\n\n`);

    // 状态图标
    const statusIcon = linkedBlock.linkStatus === 'ok' ? '✅' : '❌';

    // 基本信息
    contents.appendMarkdown(`| 属性 | 值 |\n`);
    contents.appendMarkdown(`|------|----|\n`);
    contents.appendMarkdown(`| **状态** | ${statusIcon} ${this.getStatusText(linkedBlock.linkStatus)} |\n`);
    contents.appendMarkdown(`| **文件** | \`${linkedBlock.file}\` |\n`);
    contents.appendMarkdown(`| **变量** | \`${linkedBlock.key}\` |\n`);
    contents.appendMarkdown(`| **类型** | \`${linkedBlock.type}\` |\n`);

    if (linkedBlock.linkStatus === 'ok') {
      // 显示当前值
      const valueDisplay = this.formatValueForDisplay(linkedBlock.currentValue);
      contents.appendMarkdown(`| **当前值** | ${valueDisplay} |\n`);

      // 显示位置
      if (linkedBlock.luaNode) {
        contents.appendMarkdown(`| **位置** | 第 ${linkedBlock.luaNode.loc.start.line} 行 |\n`);
      }

      // 添加跳转链接
      contents.appendMarkdown(`\n---\n`);
      const uri = vscode.Uri.file(linkedBlock.absoluteFilePath);
      const line = linkedBlock.luaNode?.loc.start.line || 1;
      contents.appendMarkdown(`[📍 跳转到 Lua 源码](${uri}#L${line})\n`);
    } else {
      // 显示错误信息
      contents.appendMarkdown(`\n---\n`);
      contents.appendMarkdown(`⚠️ **错误**: ${linkedBlock.linkError}\n`);
    }

    return new vscode.Hover(contents);
  }

  /**
   * 获取状态文本
   */
  private getStatusText(status: string): string {
    switch (status) {
      case 'ok':
        return '已链接';
      case 'file-not-found':
        return '文件不存在';
      case 'key-not-found':
        return '变量未找到';
      case 'parse-error':
        return '解析错误';
      default:
        return '未知状态';
    }
  }

  /**
   * 格式化值用于显示
   */
  private formatValueForDisplay(value: any): string {
    if (value === null || value === undefined) {
      return '`nil`';
    }

    if (typeof value === 'object') {
      try {
        const json = JSON.stringify(value, null, 2);
        if (json.length > 100) {
          return '`[复杂对象]`';
        }
        return `\`${json}\``;
      } catch {
        return '`[对象]`';
      }
    }

    return `\`${value}\``;
  }
}
