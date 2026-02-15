/**
 * Document link provider
 * Provides clickable links for lua-config code blocks and probe:// links in Markdown
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { ConfigBlockParser } from '../core/parser/configBlockParser';
import { LuaLinker, LinkedConfigBlock } from '../core/linker/luaLinker';
import { PathResolver } from '../core/linker/pathResolver';
import { ProbeScanner } from '../core/probeScanner';

export class LuaConfigDocumentLinkProvider implements vscode.DocumentLinkProvider {
  private configParser: ConfigBlockParser;
  private luaLinker: LuaLinker;
  private pathResolver: PathResolver;
  private probeScanner: ProbeScanner;

  constructor() {
    this.configParser = new ConfigBlockParser();
    this.luaLinker = new LuaLinker();
    this.pathResolver = new PathResolver();
    this.probeScanner = new ProbeScanner();
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

    // Parse config blocks
    const blocks = this.configParser.parseMarkdown(text);

    if (blocks.length > 0) {
      // Link to Lua files
      const linkedBlocks = await this.luaLinker.linkBlocks(blocks, document.uri.fsPath);

      // Create links for each config block
      for (const linkedBlock of linkedBlocks) {
        // Create file field link
        const fileLink = this.createFileLinkForBlock(document, linkedBlock);
        if (fileLink) {
          links.push(fileLink);
        }

        // Create key field link (jump to specific line)
        const keyLink = this.createKeyLinkForBlock(document, linkedBlock);
        if (keyLink) {
          links.push(keyLink);
        }
      }
    }

    // Parse probe:// links
    const probeLinks = this.createProbeLinks(document, text);
    links.push(...probeLinks);

    return links;
  }

  /**
   * Create link for file field
   */
  private createFileLinkForBlock(
    document: vscode.TextDocument,
    linkedBlock: LinkedConfigBlock
  ): vscode.DocumentLink | null {
    // Find file: line in raw text
    const fileLineMatch = linkedBlock.rawText.match(/file:\s*(.+)/);
    if (!fileLineMatch) {
      return null;
    }

    // Calculate file path position in document
    const blockStartOffset = document.getText().indexOf(linkedBlock.rawText);
    if (blockStartOffset === -1) {
      return null;
    }

    const fileLineOffset = linkedBlock.rawText.indexOf(fileLineMatch[0]);
    const filePathOffset = fileLineMatch[0].indexOf(fileLineMatch[1]);

    const startPos = document.positionAt(blockStartOffset + fileLineOffset + filePathOffset);
    const endPos = document.positionAt(blockStartOffset + fileLineOffset + filePathOffset + fileLineMatch[1].length);

    const range = new vscode.Range(startPos, endPos);

    // Create link
    if (linkedBlock.linkStatus === 'file-not-found') {
      // No link when file doesn't exist
      return undefined as any;
    }

    const targetUri = vscode.Uri.file(linkedBlock.absoluteFilePath);
    const link = new vscode.DocumentLink(range, targetUri);
    link.tooltip = vscode.l10n.t('Open {0}', linkedBlock.absoluteFilePath);

    return link;
  }

  /**
   * Create link for key field (jump to specific position in Lua file)
   */
  private createKeyLinkForBlock(
    document: vscode.TextDocument,
    linkedBlock: LinkedConfigBlock
  ): vscode.DocumentLink | null {
    if (linkedBlock.linkStatus !== 'ok' || !linkedBlock.luaNode) {
      return null;
    }

    // Find key: line in raw text
    const keyLineMatch = linkedBlock.rawText.match(/key:\s*(.+)/);
    if (!keyLineMatch) {
      return null;
    }

    // Calculate key path position in document
    const blockStartOffset = document.getText().indexOf(linkedBlock.rawText);
    if (blockStartOffset === -1) {
      return null;
    }

    const keyLineOffset = linkedBlock.rawText.indexOf(keyLineMatch[0]);
    const keyPathOffset = keyLineMatch[0].indexOf(keyLineMatch[1]);

    const startPos = document.positionAt(blockStartOffset + keyLineOffset + keyPathOffset);
    const endPos = document.positionAt(blockStartOffset + keyLineOffset + keyPathOffset + keyLineMatch[1].length);

    const range = new vscode.Range(startPos, endPos);

    // Create URI with line number
    const targetUri = vscode.Uri.file(linkedBlock.absoluteFilePath).with({
      fragment: `L${linkedBlock.luaNode.loc.start.line}`
    });

    const link = new vscode.DocumentLink(range, targetUri);
    link.tooltip = vscode.l10n.t('Jump to {0} (Line {1})', linkedBlock.key, linkedBlock.luaNode.loc.start.line) +
      `\n${vscode.l10n.t('Current value: {0}', JSON.stringify(linkedBlock.currentValue))}`;

    return link;
  }

  /**
   * Create links for probe:// URLs in Markdown
   */
  private createProbeLinks(
    document: vscode.TextDocument,
    text: string
  ): vscode.DocumentLink[] {
    const links: vscode.DocumentLink[] = [];
    const mdDir = path.dirname(document.uri.fsPath);
    const probeLinks = this.probeScanner.findProbeLinks(text);

    for (const probeLink of probeLinks) {
      // Resolve probe target
      const target = this.probeScanner.resolveProbe(
        probeLink.filePath,
        probeLink.probeName,
        mdDir
      );

      if (!target) {
        // Still create a link but with a command that shows an error
        continue;
      }

      // Calculate range - cover the full [text](probe://...) link
      const startPos = document.positionAt(probeLink.matchStart);
      const endPos = document.positionAt(probeLink.matchEnd);
      const range = new vscode.Range(startPos, endPos);

      // Create URI pointing to file + line
      const targetUri = vscode.Uri.file(target.filePath).with({
        fragment: `L${target.line}`
      });

      const link = new vscode.DocumentLink(range, targetUri);
      link.tooltip = vscode.l10n.t(
        'Jump to probe "{0}" in {1} (Line {2})',
        probeLink.probeName,
        path.basename(target.filePath),
        target.line
      );

      links.push(link);
    }

    return links;
  }

  /**
   * Resolve link (optional, for lazy resolution)
   */
  resolveDocumentLink(
    link: vscode.DocumentLink,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DocumentLink> {
    return link;
  }
}
