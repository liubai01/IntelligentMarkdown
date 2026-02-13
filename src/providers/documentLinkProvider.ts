/**
 * 文档链接提供者
 * 在 Markdown 中为 lua-config 代码块提供可点击的链接
 */

import * as vscode from 'vscode';
import { ConfigBlockParser } from '../core/parser/configBlockParser';
import { LuaLinker, LinkedConfigBlock } from '../core/linker/luaLinker';
import { PathResolver } from '../core/linker/pathResolver';

export class LuaConfigDocumentLinkProvider implements vscode.DocumentLinkProvider {
  private configParser: ConfigBlockParser;
  private luaLinker: LuaLinker;
  private pathResolver: PathResolver;

  constructor() {
    this.configParser = new ConfigBlockParser();
    this.luaLinker = new LuaLinker();
    this.pathResolver = new PathResolver();
  }

  async provideDocumentLinks(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.DocumentLink[]> {
    if (token.isCancellationRequested) {
      return [];
    }

    const links: vscode.DocumentLink[] = [];
    const text = document.getText();

    // 解析配置块
    const blocks = this.configParser.parseMarkdown(text);
    if (blocks.length === 0) {
      return [];
    }

    // 链接到 Lua 文件
    const linkedBlocks = await this.luaLinker.linkBlocks(blocks, document.uri.fsPath);

    // 为每个配置块创建链接
    for (const linkedBlock of linkedBlocks) {
      // 创建 file 字段的链接
      const fileLink = this.createFileLinkForBlock(document, linkedBlock);
      if (fileLink) {
        links.push(fileLink);
      }

      // 创建 key 字段的链接（跳转到具体行）
      const keyLink = this.createKeyLinkForBlock(document, linkedBlock);
      if (keyLink) {
        links.push(keyLink);
      }
    }

    return links;
  }

  /**
   * 为 file 字段创建链接
   */
  private createFileLinkForBlock(
    document: vscode.TextDocument,
    linkedBlock: LinkedConfigBlock
  ): vscode.DocumentLink | null {
    // 在原始文本中查找 file: 行
    const fileLineMatch = linkedBlock.rawText.match(/file:\s*(.+)/);
    if (!fileLineMatch) {
      return null;
    }

    // 计算 file 路径在文档中的位置
    const blockStartOffset = document.getText().indexOf(linkedBlock.rawText);
    if (blockStartOffset === -1) {
      return null;
    }

    const fileLineOffset = linkedBlock.rawText.indexOf(fileLineMatch[0]);
    const filePathOffset = fileLineMatch[0].indexOf(fileLineMatch[1]);

    const startPos = document.positionAt(blockStartOffset + fileLineOffset + filePathOffset);
    const endPos = document.positionAt(blockStartOffset + fileLineOffset + filePathOffset + fileLineMatch[1].length);

    const range = new vscode.Range(startPos, endPos);

    // 创建链接
    if (linkedBlock.linkStatus === 'file-not-found') {
      // 文件不存在时，链接到创建文件的命令
      return undefined as any; // 不提供链接
    }

    const targetUri = vscode.Uri.file(linkedBlock.absoluteFilePath);
    const link = new vscode.DocumentLink(range, targetUri);
    link.tooltip = `打开 ${linkedBlock.absoluteFilePath}`;

    return link;
  }

  /**
   * 为 key 字段创建链接（跳转到 Lua 文件的具体位置）
   */
  private createKeyLinkForBlock(
    document: vscode.TextDocument,
    linkedBlock: LinkedConfigBlock
  ): vscode.DocumentLink | null {
    if (linkedBlock.linkStatus !== 'ok' || !linkedBlock.luaNode) {
      return null;
    }

    // 在原始文本中查找 key: 行
    const keyLineMatch = linkedBlock.rawText.match(/key:\s*(.+)/);
    if (!keyLineMatch) {
      return null;
    }

    // 计算 key 路径在文档中的位置
    const blockStartOffset = document.getText().indexOf(linkedBlock.rawText);
    if (blockStartOffset === -1) {
      return null;
    }

    const keyLineOffset = linkedBlock.rawText.indexOf(keyLineMatch[0]);
    const keyPathOffset = keyLineMatch[0].indexOf(keyLineMatch[1]);

    const startPos = document.positionAt(blockStartOffset + keyLineOffset + keyPathOffset);
    const endPos = document.positionAt(blockStartOffset + keyLineOffset + keyPathOffset + keyLineMatch[1].length);

    const range = new vscode.Range(startPos, endPos);

    // 创建带有行号的 URI
    const targetUri = vscode.Uri.file(linkedBlock.absoluteFilePath).with({
      fragment: `L${linkedBlock.luaNode.loc.start.line}`
    });

    const link = new vscode.DocumentLink(range, targetUri);
    link.tooltip = `跳转到 ${linkedBlock.key} (第 ${linkedBlock.luaNode.loc.start.line} 行)\n当前值: ${JSON.stringify(linkedBlock.currentValue)}`;

    return link;
  }

  /**
   * 解析链接（可选，用于延迟解析）
   */
  resolveDocumentLink(
    link: vscode.DocumentLink,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DocumentLink> {
    return link;
  }
}
