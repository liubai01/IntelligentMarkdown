/**
 * Hover provider
 * Shows current source variable value on hover over lua-config code blocks in Markdown
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

    // Find the config block at the current position
    const currentBlock = blocks.find(block =>
      position.line >= block.startLine - 1 && position.line <= block.endLine - 1
    );

    if (!currentBlock) {
      return null;
    }

    // Link to Lua file to get value
    const linkedBlocks = await this.luaLinker.linkBlocks([currentBlock], document.uri.fsPath);
    const linkedBlock = linkedBlocks[0];

    if (!linkedBlock) {
      return null;
    }

    // Build hover content
    const contents = new vscode.MarkdownString();
    contents.isTrusted = true;

    // Title
    contents.appendMarkdown(`### 🔗 ${vscode.l10n.t('Config Binding')}\n\n`);

    // Status icon
    const statusIcon = linkedBlock.linkStatus === 'ok' ? '✅' : '❌';

    // Basic info
    contents.appendMarkdown(`| ${vscode.l10n.t('Property')} | ${vscode.l10n.t('Value')} |\n`);
    contents.appendMarkdown(`|------|----|\n`);
    contents.appendMarkdown(`| **${vscode.l10n.t('Status')}** | ${statusIcon} ${this.getStatusText(linkedBlock.linkStatus)} |\n`);
    contents.appendMarkdown(`| **${vscode.l10n.t('File')}** | \`${linkedBlock.file}\` |\n`);
    contents.appendMarkdown(`| **${vscode.l10n.t('Variable')}** | \`${linkedBlock.key}\` |\n`);
    contents.appendMarkdown(`| **${vscode.l10n.t('Type')}** | \`${linkedBlock.type}\` |\n`);

    if (linkedBlock.linkStatus === 'ok') {
      // Show current value
      const valueDisplay = this.formatValueForDisplay(linkedBlock.currentValue);
      contents.appendMarkdown(`| **${vscode.l10n.t('Current Value')}** | ${valueDisplay} |\n`);

      // Show position
      if (linkedBlock.luaNode) {
        contents.appendMarkdown(`| **${vscode.l10n.t('Position')}** | ${vscode.l10n.t('Line {0}', linkedBlock.luaNode.loc.start.line)} |\n`);
      }

      // Add jump link
      contents.appendMarkdown(`\n---\n`);
      const uri = vscode.Uri.file(linkedBlock.absoluteFilePath);
      const line = linkedBlock.luaNode?.loc.start.line || 1;
      contents.appendMarkdown(`[📍 ${vscode.l10n.t('Jump to Source')}](${uri}#L${line})\n`);
    } else {
      // Show error info
      contents.appendMarkdown(`\n---\n`);
      contents.appendMarkdown(`⚠️ **${vscode.l10n.t('Error')}**: ${linkedBlock.linkError}\n`);
    }

    return new vscode.Hover(contents);
  }

  /**
   * Get status text
   */
  private getStatusText(status: string): string {
    switch (status) {
      case 'ok':
        return vscode.l10n.t('Linked');
      case 'file-not-found':
        return vscode.l10n.t('File not found');
      case 'key-not-found':
        return vscode.l10n.t('Variable not found');
      case 'parse-error':
        return vscode.l10n.t('Parse error');
      default:
        return vscode.l10n.t('Unknown');
    }
  }

  /**
   * Format value for display
   */
  private formatValueForDisplay(value: any): string {
    if (value === null || value === undefined) {
      return '`nil`';
    }

    if (typeof value === 'object') {
      try {
        const json = JSON.stringify(value, null, 2);
        if (json.length > 100) {
          return `\`[${vscode.l10n.t('Complex Object')}]\``;
        }
        return `\`${json}\``;
      } catch {
        return `\`[${vscode.l10n.t('Object')}]\``;
      }
    }

    return `\`${value}\``;
  }
}
