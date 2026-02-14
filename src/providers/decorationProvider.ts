/**
 * Decoration provider
 * Shows inline Lua variable values in the editor
 */

import * as vscode from 'vscode';
import { ConfigBlockParser } from '../core/parser/configBlockParser';
import { LuaLinker, LinkedConfigBlock } from '../core/linker/luaLinker';

export class LuaConfigDecorationProvider {
  private configParser: ConfigBlockParser;
  private luaLinker: LuaLinker;

  // Decoration types
  private valueDecorationType: vscode.TextEditorDecorationType;
  private errorDecorationType: vscode.TextEditorDecorationType;

  // Active editor
  private activeEditor: vscode.TextEditor | undefined;

  // Debounce timer
  private updateTimeout: NodeJS.Timeout | undefined;

  constructor(context: vscode.ExtensionContext) {
    this.configParser = new ConfigBlockParser();
    this.luaLinker = new LuaLinker();

    // Create decoration types
    this.valueDecorationType = vscode.window.createTextEditorDecorationType({
      after: {
        color: new vscode.ThemeColor('editorCodeLens.foreground'),
        fontStyle: 'italic',
        margin: '0 0 0 1em'
      }
    });

    this.errorDecorationType = vscode.window.createTextEditorDecorationType({
      after: {
        color: new vscode.ThemeColor('errorForeground'),
        fontStyle: 'italic',
        margin: '0 0 0 1em'
      }
    });

    // Watch editor changes
    vscode.window.onDidChangeActiveTextEditor(
      editor => this.onActiveEditorChanged(editor),
      null,
      context.subscriptions
    );

    // Watch document changes
    vscode.workspace.onDidChangeTextDocument(
      event => this.onDocumentChanged(event),
      null,
      context.subscriptions
    );

    // Initial update
    this.activeEditor = vscode.window.activeTextEditor;
    if (this.activeEditor) {
      this.triggerUpdateDecorations();
    }
  }

  /**
   * Active editor changed
   */
  private onActiveEditorChanged(editor: vscode.TextEditor | undefined): void {
    this.activeEditor = editor;
    if (editor && this.isMarkdownDocument(editor.document)) {
      this.triggerUpdateDecorations();
    }
  }

  /**
   * Document content changed
   */
  private onDocumentChanged(event: vscode.TextDocumentChangeEvent): void {
    if (
      this.activeEditor &&
      event.document === this.activeEditor.document &&
      this.isMarkdownDocument(event.document)
    ) {
      this.triggerUpdateDecorations();
    }
  }

  /**
   * Trigger decoration update (with debounce)
   */
  private triggerUpdateDecorations(): void {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    this.updateTimeout = setTimeout(() => this.updateDecorations(), 300);
  }

  /**
   * Update decorations
   */
  private async updateDecorations(): Promise<void> {
    if (!this.activeEditor) {
      return;
    }

    const document = this.activeEditor.document;
    if (!this.isMarkdownDocument(document)) {
      return;
    }

    // Check configuration
    const showInlineValues = vscode.workspace
      .getConfiguration('intelligentMarkdown')
      .get('showInlineValues', true);

    if (!showInlineValues) {
      this.activeEditor.setDecorations(this.valueDecorationType, []);
      this.activeEditor.setDecorations(this.errorDecorationType, []);
      return;
    }

    const text = document.getText();
    const blocks = this.configParser.parseMarkdown(text);

    if (blocks.length === 0) {
      this.activeEditor.setDecorations(this.valueDecorationType, []);
      this.activeEditor.setDecorations(this.errorDecorationType, []);
      return;
    }

    // Link to Lua files
    const linkedBlocks = await this.luaLinker.linkBlocks(blocks, document.uri.fsPath);

    // Create decorations
    const valueDecorations: vscode.DecorationOptions[] = [];
    const errorDecorations: vscode.DecorationOptions[] = [];

    for (const linkedBlock of linkedBlocks) {
      // Find the key: line position
      const keyLinePosition = this.findKeyLinePosition(document, linkedBlock);
      if (!keyLinePosition) {
        continue;
      }

      if (linkedBlock.linkStatus === 'ok') {
        const valueText = this.formatValueText(linkedBlock.currentValue);
        valueDecorations.push({
          range: keyLinePosition,
          renderOptions: {
            after: {
              contentText: `  ← ${valueText}`
            }
          }
        });
      } else {
        errorDecorations.push({
          range: keyLinePosition,
          renderOptions: {
            after: {
              contentText: `  ⚠️ ${linkedBlock.linkError}`
            }
          }
        });
      }
    }

    this.activeEditor.setDecorations(this.valueDecorationType, valueDecorations);
    this.activeEditor.setDecorations(this.errorDecorationType, errorDecorations);
  }

  /**
   * Find key line position
   */
  private findKeyLinePosition(
    document: vscode.TextDocument,
    linkedBlock: LinkedConfigBlock
  ): vscode.Range | null {
    // Search for key: line within the config block
    for (let line = linkedBlock.startLine - 1; line < linkedBlock.endLine; line++) {
      const lineText = document.lineAt(line).text;
      if (lineText.trim().startsWith('key:')) {
        return new vscode.Range(
          new vscode.Position(line, lineText.length),
          new vscode.Position(line, lineText.length)
        );
      }
    }
    return null;
  }

  /**
   * Format value text
   */
  private formatValueText(value: any): string {
    if (value === null || value === undefined) {
      return 'nil';
    }

    if (typeof value === 'object') {
      try {
        const json = JSON.stringify(value);
        if (json.length > 50) {
          return `[${vscode.l10n.t('Object')}]`;
        }
        return json;
      } catch {
        return `[${vscode.l10n.t('Object')}]`;
      }
    }

    if (typeof value === 'string') {
      if (value.length > 30) {
        return `"${value.substring(0, 27)}..."`;
      }
      return `"${value}"`;
    }

    return String(value);
  }

  /**
   * Check if document is Markdown
   */
  private isMarkdownDocument(document: vscode.TextDocument): boolean {
    return document.languageId === 'markdown';
  }

  /**
   * Dispose
   */
  dispose(): void {
    this.valueDecorationType.dispose();
    this.errorDecorationType.dispose();
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
  }
}
