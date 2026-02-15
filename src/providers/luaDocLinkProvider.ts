/**
 * Lua Doc Link Provider
 * Provides clickable links for `-- @doc:` comments in Lua files.
 *
 * Supported formats:
 *   -- @doc:section_name                         (auto-discover .config.md)
 *   -- @doc:./path/to/file.config.md#section_name  (explicit file + section)
 *
 * Clicking the link opens/reveals the Markdown preview and scrolls to the section.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/** Parsed doc link information */
export interface DocLinkInfo {
  /** Markdown file path (relative, empty for auto-discover) */
  mdFile: string;
  /** Section/anchor ID to scroll to */
  sectionId: string;
}

/** Regex: -- @doc:section  OR  -- @doc:./file.md#section */
const DOC_LINK_REGEX = /--\s*@doc:\s*(\S+)/;

export class LuaDocLinkProvider implements vscode.DocumentLinkProvider {

  async provideDocumentLinks(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): Promise<vscode.DocumentLink[]> {
    const links: vscode.DocumentLink[] = [];
    const lineCount = document.lineCount;

    for (let i = 0; i < lineCount; i++) {
      const line = document.lineAt(i);
      const match = DOC_LINK_REGEX.exec(line.text);
      if (!match) continue;

      const raw = match[1]; // e.g. "quest-settings" or "./file.config.md#quest-settings"
      const startCol = match.index + match[0].indexOf(match[1]);
      const endCol = startCol + match[1].length;

      const range = new vscode.Range(i, startCol, i, endCol);
      const parsed = this.parseDocRef(raw);

      // Resolve the Markdown file
      const luaDir = path.dirname(document.uri.fsPath);
      const mdFilePath = parsed.mdFile
        ? path.resolve(luaDir, parsed.mdFile)
        : this.discoverMarkdownFile(document.uri.fsPath);

      if (!mdFilePath) continue;

      const link = new vscode.DocumentLink(range);
      link.tooltip = `📄 Open preview → #${parsed.sectionId}`;

      // Encode command args as URI
      link.target = vscode.Uri.parse(
        `command:intelligentMarkdown.gotoDoc?${encodeURIComponent(
          JSON.stringify({ mdFile: mdFilePath, sectionId: parsed.sectionId })
        )}`
      );

      links.push(link);
    }

    return links;
  }

  /**
   * Parse a @doc reference string.
   * Formats:
   *   "section_name"          → { mdFile: '', sectionId: 'section_name' }
   *   "./file.md#section"     → { mdFile: './file.md', sectionId: 'section' }
   */
  private parseDocRef(raw: string): DocLinkInfo {
    const hashIdx = raw.indexOf('#');
    if (hashIdx !== -1 && (raw.startsWith('./') || raw.startsWith('../') || /\.\w+#/.test(raw))) {
      return {
        mdFile: raw.substring(0, hashIdx),
        sectionId: raw.substring(hashIdx + 1),
      };
    }
    // No file path — just a section name
    return { mdFile: '', sectionId: raw };
  }

  /**
   * Auto-discover a .config.md file that references the given Lua file.
   * Searches in the same directory for *.config.md files containing `file: ./luaBaseName`.
   */
  private discoverMarkdownFile(luaFilePath: string): string | null {
    const luaDir = path.dirname(luaFilePath);
    const luaBaseName = path.basename(luaFilePath);

    try {
      const files = fs.readdirSync(luaDir);
      for (const file of files) {
        if (!file.endsWith('.config.md') && !file.endsWith('.md')) continue;
        const fullPath = path.join(luaDir, file);
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          // Check if this MD file references the Lua file
          if (
            content.includes(`file: ./${luaBaseName}`) ||
            content.includes(`file: ${luaBaseName}`) ||
            content.includes(`probe://./${luaBaseName}`)
          ) {
            return fullPath;
          }
        } catch {
          // Skip unreadable files
        }
      }
    } catch {
      // Directory read failed
    }

    return null;
  }
}
