/**
 * 装饰器提供者
 * 在编辑器中内联显示 Lua 变量的当前值
 */

import * as vscode from 'vscode';
import { ConfigBlockParser } from '../core/parser/configBlockParser';
import { LuaLinker, LinkedConfigBlock } from '../core/linker/luaLinker';

export class LuaConfigDecorationProvider {
  private configParser: ConfigBlockParser;
  private luaLinker: LuaLinker;

  // 装饰类型
  private valueDecorationType: vscode.TextEditorDecorationType;
  private errorDecorationType: vscode.TextEditorDecorationType;

  // 活跃编辑器
  private activeEditor: vscode.TextEditor | undefined;

  // 防抖定时器
  private updateTimeout: NodeJS.Timeout | undefined;

  constructor(context: vscode.ExtensionContext) {
    this.configParser = new ConfigBlockParser();
    this.luaLinker = new LuaLinker();

    // 创建装饰类型
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

    // 监听编辑器变化
    vscode.window.onDidChangeActiveTextEditor(
      editor => this.onActiveEditorChanged(editor),
      null,
      context.subscriptions
    );

    // 监听文档变化
    vscode.workspace.onDidChangeTextDocument(
      event => this.onDocumentChanged(event),
      null,
      context.subscriptions
    );

    // 初始更新
    this.activeEditor = vscode.window.activeTextEditor;
    if (this.activeEditor) {
      this.triggerUpdateDecorations();
    }
  }

  /**
   * 活跃编辑器变化
   */
  private onActiveEditorChanged(editor: vscode.TextEditor | undefined): void {
    this.activeEditor = editor;
    if (editor && this.isMarkdownDocument(editor.document)) {
      this.triggerUpdateDecorations();
    }
  }

  /**
   * 文档内容变化
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
   * 触发更新装饰（带防抖）
   */
  private triggerUpdateDecorations(): void {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    this.updateTimeout = setTimeout(() => this.updateDecorations(), 300);
  }

  /**
   * 更新装饰
   */
  private async updateDecorations(): Promise<void> {
    if (!this.activeEditor) {
      return;
    }

    const document = this.activeEditor.document;
    if (!this.isMarkdownDocument(document)) {
      return;
    }

    // 检查配置
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

    // 链接到 Lua 文件
    const linkedBlocks = await this.luaLinker.linkBlocks(blocks, document.uri.fsPath);

    // 创建装饰
    const valueDecorations: vscode.DecorationOptions[] = [];
    const errorDecorations: vscode.DecorationOptions[] = [];

    for (const linkedBlock of linkedBlocks) {
      // 查找 key: 行的位置
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
   * 查找 key 行的位置
   */
  private findKeyLinePosition(
    document: vscode.TextDocument,
    linkedBlock: LinkedConfigBlock
  ): vscode.Range | null {
    // 在配置块内查找 key: 行
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
   * 格式化值文本
   */
  private formatValueText(value: any): string {
    if (value === null || value === undefined) {
      return 'nil';
    }

    if (typeof value === 'object') {
      try {
        const json = JSON.stringify(value);
        if (json.length > 50) {
          return '[对象]';
        }
        return json;
      } catch {
        return '[对象]';
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
   * 判断是否是 Markdown 文档
   */
  private isMarkdownDocument(document: vscode.TextDocument): boolean {
    return document.languageId === 'markdown';
  }

  /**
   * 销毁
   */
  dispose(): void {
    this.valueDecorationType.dispose();
    this.errorDecorationType.dispose();
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
  }
}
