/**
 * Smart Markdown Editor
 * Visual config preview editor based on Webview
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { ConfigBlockParser } from '../core/parser/configBlockParser';
import { WizardBlockParser } from '../core/parser/wizardBlockParser';
import { LuaLinker, LinkedConfigBlock } from '../core/linker/luaLinker';
import { LuaParser } from '../core/parser/luaParser';
import { LuaPatcher } from '../core/patcher/luaPatcher';
import { JsonParser } from '../core/parser/jsonParser';
import { JsonPatcher } from '../core/patcher/jsonPatcher';
import { PathResolver } from '../core/linker/pathResolver';
import { ProbeScanner } from '../core/probeScanner';
import { ParsedWizardBlock, WizardStep, WizardVariable } from '../types';

export class SmartMarkdownEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'intelligentMarkdown.preview';

  private configParser: ConfigBlockParser;
  private wizardParser: WizardBlockParser;
  private luaLinker: LuaLinker;
  private pathResolver: PathResolver;
  private probeScanner: ProbeScanner;
  /** Code block indent normalization cache (rebuilt on each render) */
  private codeNormCache: Map<string, { normalized: string; baseIndent: string }> = new Map();
  /** Whether the extension is running inside Cursor IDE */
  private readonly isCursorIDE: boolean;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.isCursorIDE = vscode.env.appName.toLowerCase().includes('cursor');
    this.configParser = new ConfigBlockParser();
    this.wizardParser = new WizardBlockParser();
    this.luaLinker = new LuaLinker();
    this.pathResolver = new PathResolver();
    this.probeScanner = new ProbeScanner();
  }

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // Configure Webview
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };

    // Initial render
    await this.updateWebview(document, webviewPanel.webview);

    // Listen to Webview messages
    webviewPanel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case 'updateValue':
            await this.handleUpdateValue(document, message);
            await this.updateWebview(document, webviewPanel.webview);
            break;
          case 'updateTableCell':
            await this.handleUpdateTableCell(document, message);
            await this.updateWebview(document, webviewPanel.webview);
            break;
          case 'saveCode':
            await this.handleSaveCode(document, message);
            await this.updateWebview(document, webviewPanel.webview);
            break;
          case 'gotoSource':
            await this.handleGotoSource(message, document.uri);
            break;
          case 'gotoProbe':
            await this.handleGotoSource(message, document.uri);
            break;
          case 'copyToClipboard':
            await vscode.env.clipboard.writeText(message.text || '');
            webviewPanel.webview.postMessage({ type: 'clipboardDone' });
            break;
          case 'addFileToChat':
            await this.handleAddFileToChat(message);
            break;
          case 'executeWizard':
            await this.handleExecuteWizard(document, message, webviewPanel.webview);
            // Only refresh webview for 'append' action (which modifies files)
            if (message.action !== 'run') {
              await this.updateWebview(document, webviewPanel.webview);
            }
            break;
          case 'refresh':
            await this.updateWebview(document, webviewPanel.webview);
            break;
        }
      },
      undefined,
      this.context.subscriptions
    );

    // Listen to document changes
    const changeSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        this.updateWebview(document, webviewPanel.webview);
      }
    });

    // Listen to source file changes (Lua + JSON)
    const luaWatcher = vscode.workspace.createFileSystemWatcher('**/*.lua');
    const jsonWatcher = vscode.workspace.createFileSystemWatcher('**/*.json');
    const jsoncWatcher = vscode.workspace.createFileSystemWatcher('**/*.jsonc');
    luaWatcher.onDidChange(() => {
      this.luaLinker.clearCache();
      this.updateWebview(document, webviewPanel.webview);
    });
    jsonWatcher.onDidChange(() => {
      this.luaLinker.clearCache();
      this.updateWebview(document, webviewPanel.webview);
    });
    jsoncWatcher.onDidChange(() => {
      this.luaLinker.clearCache();
      this.updateWebview(document, webviewPanel.webview);
    });

    webviewPanel.onDidDispose(() => {
      changeSubscription.dispose();
      luaWatcher.dispose();
      jsonWatcher.dispose();
      jsoncWatcher.dispose();
    });
  }

  /**
   * Update Webview content
   */
  private async updateWebview(
    document: vscode.TextDocument,
    webview: vscode.Webview
  ): Promise<void> {
    const text = document.getText();
    const blocks = this.configParser.parseMarkdown(text);
    const linkedBlocks = await this.luaLinker.linkBlocks(blocks, document.uri.fsPath);
    const wizardBlocks = this.wizardParser.parseMarkdown(text);

    webview.html = this.getHtmlContent(webview, text, linkedBlocks, document.uri.fsPath, wizardBlocks);

    // Phase 2: Send heavy block data asynchronously for progressive loading
    this.sendDeferredBlockData(webview, linkedBlocks);
  }

  /**
   * Send heavy block data (tables, code editors) to webview asynchronously.
   * Each block is sent with a small delay so the UI can render progressively.
   */
  private sendDeferredBlockData(
    webview: vscode.Webview,
    linkedBlocks: LinkedConfigBlock[]
  ): void {
    const heavyBlocks: Array<{ blockId: string; block: LinkedConfigBlock }> = [];

    for (const block of linkedBlocks) {
      if (block.linkStatus !== 'ok') { continue; }
      const blockId = this.generateBlockId(block);
      if (block.type === 'table' || block.type === 'code') {
        heavyBlocks.push({ blockId, block });
      }
    }

    // Send each heavy block with incremental delay
    const DELAY_STEP = 50; // ms between each block
    heavyBlocks.forEach(({ blockId, block }, index) => {
      setTimeout(() => {
        if (block.type === 'table') {
          const tableData = block.luaNode?.tableData;
          if (!tableData || tableData.length === 0) { return; }

          const rowData = tableData.map(row => row.data);
          const rowLocations = tableData.map(row => ({
            line: row.rowLoc?.start.line || 0,
            file: block.absoluteFilePath || ''
          }));

          webview.postMessage({
            type: 'initBlock',
            blockType: 'table',
            blockId,
            columns: block.columns,
            rows: rowData,
            rowLocations,
            rowCount: tableData.length
          });
        } else if (block.type === 'code') {
          const normData = this.codeNormCache.get(blockId);
          webview.postMessage({
            type: 'initBlock',
            blockType: 'code',
            blockId,
            originalCode: normData?.normalized || block.currentValue || '',
            lang: 'lua',
            baseIndent: normData?.baseIndent || ''
          });
        }
      }, DELAY_STEP * (index + 1));
    });
  }

  /**
   * Handle value update
   */
  private async handleUpdateValue(
    document: vscode.TextDocument,
    message: { file: string; key: string; value: any; valueType: string }
  ): Promise<void> {
    try {
      const mdDir = path.dirname(document.uri.fsPath);
      const sourcePath = this.pathResolver.resolve(mdDir, message.file);
      const isJsonFile = /\.(json|jsonc)$/i.test(sourcePath);

      if (!fs.existsSync(sourcePath)) {
        vscode.window.showErrorMessage(vscode.l10n.t('File not found: {0}', sourcePath));
        return;
      }

      const sourceCode = fs.readFileSync(sourcePath, 'utf-8');
      let newCode = sourceCode;

      if (isJsonFile) {
        const parser = new JsonParser(sourceCode);
        const result = parser.findNodeByPath(message.key);
        if (!result.success || !result.node) {
          vscode.window.showErrorMessage(vscode.l10n.t('Variable not found: {0}', message.key));
          return;
        }
        const patcher = new JsonPatcher(sourceCode);
        newCode = patcher.updateValue(message.key, message.value);
      } else {
        const parser = new LuaParser(sourceCode);
        const result = parser.findNodeByPath(message.key);
        if (!result.success || !result.node) {
          vscode.window.showErrorMessage(vscode.l10n.t('Variable not found: {0}', message.key));
          return;
        }
        const patcher = new LuaPatcher(sourceCode);
        newCode = patcher.updateValue(result.node, message.value);
      }

      // Write file
      fs.writeFileSync(sourcePath, newCode, 'utf-8');

      // Clear cache
      this.luaLinker.clearCache(sourcePath);

      vscode.window.showInformationMessage(vscode.l10n.t('Updated {0} = {1}', message.key, message.value));
    } catch (error) {
      vscode.window.showErrorMessage(
        vscode.l10n.t('Update failed: {0}', error instanceof Error ? error.message : String(error))
      );
    }
  }

  /**
   * Handle table cell update
   */
  private async handleUpdateTableCell(
    document: vscode.TextDocument,
    message: { file: string; key: string; rowIndex: number; colKey: string; value: any }
  ): Promise<void> {
    try {
      const mdDir = path.dirname(document.uri.fsPath);
      const luaPath = this.pathResolver.resolve(mdDir, message.file);

      if (!fs.existsSync(luaPath)) {
        vscode.window.showErrorMessage(`文件不存在: ${luaPath}`);
        return;
      }

      // Read Lua file
      const luaCode = fs.readFileSync(luaPath, 'utf-8');

      // Parse and locate table array
      const parser = new LuaParser(luaCode);
      const result = parser.findNodeByPath(message.key);

      if (!result.success || !result.astNode) {
        vscode.window.showErrorMessage(vscode.l10n.t('Variable not found: {0}', message.key));
        return;
      }

      // Extract table array
      const tableData = parser.extractTableArray(result.astNode);
      
      if (!tableData || message.rowIndex >= tableData.length) {
        vscode.window.showErrorMessage(vscode.l10n.t('Invalid row index: {0}', message.rowIndex));
        return;
      }

      // Get target cell range
      const cellRange = tableData[message.rowIndex].ranges[message.colKey];
      
      if (!cellRange) {
        vscode.window.showErrorMessage(vscode.l10n.t('Field not found: {0}', message.colKey));
        return;
      }

      // Determine value type
      let valueType: 'number' | 'string' | 'boolean' = 'string';
      if (typeof message.value === 'number') {
        valueType = 'number';
      } else if (typeof message.value === 'boolean') {
        valueType = 'boolean';
      }

      // Generate new code
      const patcher = new LuaPatcher(luaCode);
      const newCode = patcher.updateValueByRange(cellRange, message.value, valueType);

      // Write file
      fs.writeFileSync(luaPath, newCode, 'utf-8');

      // Clear cache
      this.luaLinker.clearCache(luaPath);

      vscode.window.showInformationMessage(
        vscode.l10n.t('Updated table [{0}].{1} = {2}', message.rowIndex, message.colKey, message.value)
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        vscode.l10n.t('Table update failed: {0}', error instanceof Error ? error.message : String(error))
      );
    }
  }

  /**
   * Jump to source (smart: reuse already-open editor tabs).
   * Fallback priority when file is not already open:
   *   1. Open in the same column as the Markdown source file
   *   2. ViewColumn.Beside
   */
  private async handleGotoSource(
    message: { file: string; line: number },
    markdownUri?: vscode.Uri
  ): Promise<void> {
    try {
      const uri = vscode.Uri.file(message.file);
      const position = new vscode.Position(Math.max(0, message.line - 1), 0);

      // 1. Check if target file is already open
      let targetColumn = this.findOpenEditorColumn(uri);

      // 2. If not open, try to open in the same column as the Markdown source file
      if (targetColumn === undefined && markdownUri) {
        targetColumn = this.findOpenEditorColumn(markdownUri);
      }

      const document = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(document, {
        viewColumn: targetColumn ?? vscode.ViewColumn.Beside,
        preserveFocus: false
      });

      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
    } catch (error) {
      vscode.window.showErrorMessage(vscode.l10n.t('Unable to open file'));
    }
  }

  /**
   * Handle "Add to Chat" — open a new Cursor chat with the file as @file context.
   *
   * Strategy:
   *   1. workbench.action.chat.open  →  creates a fresh composer tab (100% reliable)
   *   2. composer.addfilestocomposer  →  attaches the file as native @file context badge
   *   3. Fallback: copy @file reference to clipboard
   */
  private async handleAddFileToChat(
    message: { absoluteFilePath: string; workspaceRelativePath: string }
  ): Promise<void> {
    try {
      const filePath = message.absoluteFilePath;
      if (!filePath) {
        vscode.window.showWarningMessage(vscode.l10n.t('Source file path not available'));
        return;
      }

      const fileUri = vscode.Uri.file(filePath);
      const fileName = path.basename(filePath);

      // Step 1: Create a new chat tab (always works, gives us a clean composer)
      try {
        await vscode.commands.executeCommand('workbench.action.chat.open');
      } catch {
        // ignore — composer may already be focused
      }

      // Brief delay to let the composer initialise
      await new Promise(resolve => setTimeout(resolve, 150));

      // Step 2: Add the file as native @file context (creates the badge)
      try {
        await vscode.commands.executeCommand('composer.addfilestocomposer', fileUri);
      } catch {
        // If addfilestocomposer fails, fall back to clipboard
        const wsRel = message.workspaceRelativePath || fileName;
        await vscode.env.clipboard.writeText(`@${wsRel}`);
        vscode.window.showInformationMessage(
          vscode.l10n.t('File reference copied — press Ctrl+V to paste: @{0}', wsRel)
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(vscode.l10n.t('Failed to add file to chat'));
    }
  }

  /**
   * Find if a file is already open in an editor tab and return its ViewColumn.
   * Checks visible editors first, then scans recent tabs across all groups.
   * Returns undefined if not found.
   */
  private findOpenEditorColumn(uri: vscode.Uri): vscode.ViewColumn | undefined {
    // 1. Check visible editors (fastest path)
    const visibleEditor = vscode.window.visibleTextEditors.find(
      editor => editor.document.uri.fsPath === uri.fsPath
    );
    if (visibleEditor?.viewColumn) {
      return visibleEditor.viewColumn;
    }

    // 2. Scan tab groups (check most recent tabs to avoid performance issues)
    const MAX_TABS_PER_GROUP = 15;
    for (const group of vscode.window.tabGroups.all) {
      const tabs = group.tabs;
      const startIdx = Math.max(0, tabs.length - MAX_TABS_PER_GROUP);
      for (let i = tabs.length - 1; i >= startIdx; i--) {
        const tab = tabs[i];
        if (tab.input instanceof vscode.TabInputText) {
          if (tab.input.uri.fsPath === uri.fsPath) {
            return group.viewColumn;
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Normalize indentation: extract and remove common indent prefix from non-first lines
   * First line unchanged (usually function keyword, no leading indent)
   */
  private normalizeIndentation(code: string): { normalized: string; baseIndent: string } {
    const lines = code.split('\n');
    if (lines.length <= 1) { return { normalized: code, baseIndent: '' }; }

    // Find minimum indent of non-empty lines from line 2 onwards
    let minIndent = Infinity;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') { continue; }
      const match = line.match(/^(\s+)/);
      const indent = match ? match[1].length : 0;
      minIndent = Math.min(minIndent, indent);
    }

    if (minIndent === 0 || minIndent === Infinity) { return { normalized: code, baseIndent: '' }; }

    // Extract baseIndent actual string (preserve tab/space as is)
    const refLine = lines.find((l, i) => i > 0 && l.trim() !== '');
    const baseIndent = refLine ? refLine.substring(0, minIndent) : ' '.repeat(minIndent);

    const normalizedLines = lines.map((line, i) => {
      if (i === 0) { return line; }
      if (line.trim() === '') { return ''; }
      return line.substring(minIndent);
    });

    return { normalized: normalizedLines.join('\n'), baseIndent };
  }

  /**
   * Restore indentation
   */
  private denormalizeIndentation(code: string, baseIndent: string): string {
    if (!baseIndent) { return code; }
    const lines = code.split('\n');
    return lines.map((line, i) => {
      if (i === 0) { return line; }
      if (line.trim() === '') { return line; }
      return baseIndent + line;
    }).join('\n');
  }

  /**
   * Get language from file path
   */
  private getLanguageFromFile(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const langMap: Record<string, string> = {
      '.lua': 'lua', '.js': 'javascript', '.ts': 'typescript',
      '.py': 'python', '.rb': 'ruby', '.go': 'go', '.rs': 'rust',
      '.java': 'java', '.c': 'c', '.cpp': 'cpp', '.h': 'c',
      '.cs': 'csharp', '.sh': 'bash', '.sql': 'sql', '.json': 'json',
      '.xml': 'xml', '.html': 'html', '.css': 'css', '.yaml': 'yaml',
      '.yml': 'yaml', '.toml': 'ini', '.md': 'markdown',
    };
    return langMap[ext] || 'plaintext';
  }

  /**
   * Generate HTML content
   */
  private getHtmlContent(
    webview: vscode.Webview,
    markdownText: string,
    linkedBlocks: LinkedConfigBlock[],
    documentPath: string,
    wizardBlocks: ParsedWizardBlock[] = []
  ): string {
    // Clear indent normalization cache
    this.codeNormCache.clear();

    // Convert markdown to HTML and replace config blocks with controls
    const htmlContent = this.renderMarkdownWithControls(markdownText, linkedBlocks, documentPath, wizardBlocks);

    // CodeMirror bundle URI
    const codeEditorScriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'codeEditor.js')
    );

    // Mermaid bundle URI
    const mermaidScriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'mermaid.js')
    );

    // Tabulator bundle URI
    const tabulatorScriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'tabulator.js')
    );
    const tabulatorCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'tabulator.css')
    );

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; img-src ${webview.cspSource} data:;">
  <title>${vscode.l10n.t('Config Preview')}</title>
  <link rel="stylesheet" href="${tabulatorCssUri}">
  <style>
    ${this.getStyles()}
  </style>
</head>
<body>
  <div class="container">
    <div class="toolbar">
      <button onclick="refresh()" title="${vscode.l10n.t('Refresh')}">🔄 ${vscode.l10n.t('Refresh')}</button>
    </div>
    <div class="content">
      ${htmlContent}
    </div>
  </div>
  <script src="${codeEditorScriptUri}"></script>
  <script src="${mermaidScriptUri}"></script>
  <script src="${tabulatorScriptUri}"></script>
  <script>
    ${this.getScript(linkedBlocks, wizardBlocks)}
  </script>
</body>
</html>`;
  }

  /**
   * Render Markdown and replace config blocks with controls
   */
  private renderMarkdownWithControls(
    markdownText: string,
    linkedBlocks: LinkedConfigBlock[],
    documentPath: string,
    wizardBlocks: ParsedWizardBlock[] = []
  ): string {
    let html = markdownText;

    // Step 1: Replace config blocks with placeholders to avoid Markdown conversion affecting HTML
    const placeholders: Map<string, string> = new Map();
    for (let i = 0; i < linkedBlocks.length; i++) {
      const block = linkedBlocks[i];
      const placeholder = `__CONFIG_BLOCK_PLACEHOLDER_${i}__`;
      const controlHtml = this.renderConfigControl(block);
      placeholders.set(placeholder, controlHtml);
      html = html.replace(block.rawText, placeholder);
    }

    // Step 1.1: Replace wizard blocks with placeholders
    for (let i = 0; i < wizardBlocks.length; i++) {
      const wizard = wizardBlocks[i];
      const placeholder = `__WIZARD_BLOCK_PLACEHOLDER_${i}__`;
      const wizardHtml = this.renderWizardBlock(wizard, i, documentPath);
      placeholders.set(placeholder, wizardHtml);
      html = html.replace(wizard.rawText, placeholder);
    }

    // Compute mdDir early (needed by mermaid probe clicks and probe links)
    const mdDir = path.dirname(documentPath);

    // Step 1.5: Replace mermaid code blocks with placeholders
    let mermaidIndex = 0;
    const mermaidRegex = /```mermaid\s*\n([\s\S]*?)```/g;
    let match;
    while ((match = mermaidRegex.exec(html)) !== null) {
      const fullMatch = match[0];
      const mermaidCode = match[1].trim();
      const placeholder = `__MERMAID_BLOCK_PLACEHOLDER_${mermaidIndex}__`;
      const mermaidHtml = this.renderMermaidBlock(mermaidCode, mermaidIndex, mdDir);
      placeholders.set(placeholder, mermaidHtml);
      html = html.replace(fullMatch, placeholder);
      mermaidIndex++;
      // Reset regex since we modified the string
      mermaidRegex.lastIndex = 0;
    }

    // Step 1.6: Resolve probe:// links to clickable HTML links
    html = this.resolveProbeLinks(html, mdDir);

    // Step 2: Markdown conversion
    html = this.simpleMarkdownToHtml(html);

    // Step 3: Replace placeholders back to actual HTML controls
    for (const [placeholder, controlHtml] of placeholders) {
      html = html.replace(placeholder, controlHtml);
    }

    return html;
  }

  /**
   * Resolve dynamic variables defined in a wizard block.
   * Returns a map of variable name → resolved string value.
   */
  private resolveWizardVariables(
    variables: Record<string, WizardVariable> | undefined,
    documentPath: string
  ): Record<string, string> {
    const resolved: Record<string, string> = {};
    if (!variables) { return resolved; }

    const mdDir = path.dirname(documentPath);
    for (const [key, varDef] of Object.entries(variables)) {
      try {
        if (varDef.type === 'json') {
          const filePath = this.pathResolver.resolve(mdDir, varDef.file);
          if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const json = JSON.parse(content);
            // Traverse dot-separated path
            const parts = varDef.path.split('.');
            let val: any = json;
            for (const part of parts) {
              if (val && typeof val === 'object' && part in val) {
                val = val[part];
              } else {
                val = undefined;
                break;
              }
            }
            resolved[key] = val !== undefined ? String(val) : '';
          }
        }
      } catch {
        resolved[key] = '';
      }
    }
    return resolved;
  }

  /**
   * Replace {{variable}} placeholders with resolved variable values in a string.
   * Used for step descriptions and default values.
   */
  private applyVariablesToString(text: string, vars: Record<string, string>): string {
    let result = text;
    for (const [key, val] of Object.entries(vars)) {
      result = result.split('{{' + key + '}}').join(val);
    }
    return result;
  }

  /**
   * Render a wizard block as a multi-step form UI
   */
  private renderWizardBlock(wizard: ParsedWizardBlock, index: number, documentPath: string): string {
    const wizardId = `wizard-${index}`;
    const icon = wizard.icon || (wizard.action === 'run' ? '🚀' : '🧙');
    const label = wizard.label || (wizard.action === 'run' ? vscode.l10n.t('Command Wizard') : vscode.l10n.t('Code Wizard'));
    const totalSteps = wizard.steps.length;
    const isRunAction = wizard.action === 'run';

    // Resolve absolute file path for the target
    const mdDir = path.dirname(documentPath);
    const absoluteFilePath = wizard.file ? this.pathResolver.resolve(mdDir, wizard.file) : '';

    // Resolve dynamic variables
    const resolvedVars = this.resolveWizardVariables(wizard.variables, documentPath);

    // Apply resolved variables to step descriptions and defaults
    const processedSteps = wizard.steps.map(step => {
      const processed = { ...step };
      if (typeof processed.description === 'string') {
        processed.description = this.applyVariablesToString(processed.description, resolvedVars);
      }
      if (typeof processed.default === 'string') {
        processed.default = this.applyVariablesToString(processed.default, resolvedVars);
      }
      return processed;
    });

    // Build step forms
    let stepsHtml = '';
    for (let i = 0; i < processedSteps.length; i++) {
      const step = processedSteps[i];
      const stepId = `${wizardId}-step-${i}`;
      const isFirst = i === 0;
      const isLast = i === processedSteps.length - 1;

      const confirmLabel = isRunAction
        ? `▶️ ${vscode.l10n.t('Execute')}`
        : `✅ ${vscode.l10n.t('Create')}`;

      stepsHtml += `
        <div class="wizard-step" id="${stepId}" style="display: ${isFirst ? 'block' : 'none'};">
          <div class="wizard-step-header">
            <span class="wizard-step-badge">${vscode.l10n.t('Step')} ${i + 1} / ${totalSteps}</span>
            <span class="wizard-step-title">${this.escapeHtml(step.label)}</span>
          </div>
          ${step.description ? `<div class="wizard-step-desc">${this.escapeHtml(step.description)}</div>` : ''}
          <div class="wizard-step-input">
            ${this.renderWizardStepInput(wizardId, step, i)}
          </div>
          <div class="wizard-step-actions">
            ${!isFirst ? `<button class="wizard-btn wizard-btn-secondary" onclick="wizardPrevStep('${wizardId}', ${i})">⬅ ${vscode.l10n.t('Previous')}</button>` : '<div></div>'}
            ${!isLast
              ? `<button class="wizard-btn wizard-btn-primary" onclick="wizardNextStep('${wizardId}', ${i})">${vscode.l10n.t('Next')} ➡</button>`
              : `<button class="wizard-btn wizard-btn-success" onclick="wizardExecute('${wizardId}')">${confirmLabel}</button>`
            }
          </div>
        </div>`;
    }

    // Preview area — different text based on action type
    const previewHeader = isRunAction
      ? vscode.l10n.t('Commands Preview')
      : vscode.l10n.t('Preview');
    const confirmBtnLabel = isRunAction
      ? `▶️ ${vscode.l10n.t('Confirm & Execute')}`
      : `✅ ${vscode.l10n.t('Confirm & Insert')}`;

    const previewHtml = `
      <div class="wizard-preview" id="${wizardId}-preview" style="display: none;">
        <div class="wizard-preview-header">${previewHeader}</div>
        <pre class="wizard-preview-code" id="${wizardId}-preview-code"></pre>
        <div class="wizard-step-actions">
          <button class="wizard-btn wizard-btn-secondary" onclick="wizardHidePreview('${wizardId}')">${vscode.l10n.t('Back')}</button>
          <button class="wizard-btn wizard-btn-success" onclick="wizardConfirm('${wizardId}')">${confirmBtnLabel}</button>
        </div>
      </div>`;

    // Store wizard data as JSON attribute
    const wizardData = {
      file: wizard.file,
      target: wizard.target,
      action: wizard.action,
      template: wizard.template,
      commands: wizard.commands,
      cwd: wizard.cwd,
      steps: processedSteps,
      absoluteFilePath,
      resolvedVars
    };
    const dataAttr = this.escapeHtml(JSON.stringify(wizardData));

    // Header subtitle: show target for append, cwd for run
    const subtitleText = isRunAction
      ? (wizard.cwd || '.')
      : (wizard.target || '');
    const subtitleTitle = isRunAction
      ? vscode.l10n.t('Working directory: {0}', wizard.cwd || '.')
      : `${wizard.file} → ${wizard.target || ''}`;

    return `
<div class="wizard-block" id="${wizardId}" data-wizard='${dataAttr}'>
  <div class="wizard-header">
    <span class="wizard-icon">${icon}</span>
    <span class="wizard-title">${this.escapeHtml(label)}</span>
    <span class="wizard-target" title="${this.escapeHtml(subtitleTitle)}">${this.escapeHtml(subtitleText)}</span>
  </div>
  <div class="wizard-progress" id="${wizardId}-progress">
    ${processedSteps.map((s: WizardStep, i: number) => `<div class="wizard-progress-dot ${i === 0 ? 'active' : ''}" id="${wizardId}-dot-${i}" title="${this.escapeHtml(s.label)}">${i + 1}</div>`).join('<div class="wizard-progress-line"></div>')}
  </div>
  <div class="wizard-body">
    ${stepsHtml}
    ${previewHtml}
  </div>
</div>`;
  }

  /**
   * Render input control for a single wizard step
   */
  private renderWizardStepInput(wizardId: string, step: WizardStep, stepIndex: number): string {
    const inputId = `${wizardId}-input-${stepIndex}`;
    const defaultVal = step.default !== undefined ? step.default : '';

    switch (step.type) {
      case 'number': {
        const minAttr = step.min !== undefined ? ` min="${step.min}"` : '';
        const maxAttr = step.max !== undefined ? ` max="${step.max}"` : '';
        const stepAttr = step.step !== undefined ? ` step="${step.step}"` : '';
        return `<input type="number" class="wizard-input" id="${inputId}" value="${defaultVal}"${minAttr}${maxAttr}${stepAttr} />`;
      }
      case 'string':
        return `<input type="text" class="wizard-input" id="${inputId}" value="${this.escapeHtml(String(defaultVal))}" placeholder="${this.escapeHtml(step.label)}" />`;
      case 'boolean':
        return `
          <label class="wizard-checkbox">
            <input type="checkbox" id="${inputId}" ${defaultVal ? 'checked' : ''} onchange="this.nextElementSibling.textContent = this.checked ? 'true' : 'false'" />
            <span>${defaultVal ? 'true' : 'false'}</span>
          </label>`;
      case 'select': {
        const opts = (step.options || [])
          .map((o: { label: string; value: string | number }) => `<option value="${this.escapeHtml(String(o.value))}" ${o.value === defaultVal ? 'selected' : ''}>${this.escapeHtml(o.label)}</option>`)
          .join('');
        return `<select class="wizard-input" id="${inputId}">${opts}</select>`;
      }
      default:
        return `<input type="text" class="wizard-input" id="${inputId}" value="${this.escapeHtml(String(defaultVal))}" />`;
    }
  }

  /**
   * Handle wizard execution — dispatch based on action type
   */
  private async handleExecuteWizard(
    document: vscode.TextDocument,
    message: { file: string; target: string; action: string; generatedCode: string; commands?: string; cwd?: string; wizardId?: string },
    webview: vscode.Webview
  ): Promise<void> {
    if (message.action === 'run') {
      await this.handleExecuteWizardRun(document, message, webview);
    } else {
      await this.handleExecuteWizardAppend(document, message, webview);
    }
  }

  /**
   * Handle wizard 'append' action — generate code from template and insert into Lua file
   */
  private async handleExecuteWizardAppend(
    document: vscode.TextDocument,
    message: { file: string; target: string; action: string; generatedCode: string; wizardId?: string },
    webview: vscode.Webview
  ): Promise<void> {
    const wizardId = message.wizardId || '';
    try {
      const mdDir = path.dirname(document.uri.fsPath);
      const luaPath = this.pathResolver.resolve(mdDir, message.file);

      if (!fs.existsSync(luaPath)) {
        const errMsg = vscode.l10n.t('File not found: {0}', luaPath);
        vscode.window.showErrorMessage(errMsg);
        webview.postMessage({ type: 'wizardResult', wizardId, success: false, message: errMsg });
        return;
      }

      const luaCode = fs.readFileSync(luaPath, 'utf-8');

      // Parse the Lua file to find the target table
      const parser = new LuaParser(luaCode);
      const result = parser.findNodeByPath(message.target);

      if (!result.success || !result.node) {
        const errMsg = vscode.l10n.t('Target not found: {0}', message.target);
        vscode.window.showErrorMessage(errMsg);
        webview.postMessage({ type: 'wizardResult', wizardId, success: false, message: errMsg });
        return;
      }

      // The target should be a table
      if (result.node.type !== 'table') {
        const errMsg = vscode.l10n.t('Target is not a table: {0}', message.target);
        vscode.window.showErrorMessage(errMsg);
        webview.postMessage({ type: 'wizardResult', wizardId, success: false, message: errMsg });
        return;
      }

      // Find the insertion point: before the closing } of the table
      const tableEndPos = result.node.range[1];
      const beforeTable = luaCode.substring(0, tableEndPos);
      const closingBraceIdx = beforeTable.lastIndexOf('}');

      if (closingBraceIdx === -1) {
        const errMsg = vscode.l10n.t('Cannot find insertion point in table');
        vscode.window.showErrorMessage(errMsg);
        webview.postMessage({ type: 'wizardResult', wizardId, success: false, message: errMsg });
        return;
      }

      // Detect the indentation of existing table entries
      const tableContent = luaCode.substring(result.node.range[0], result.node.range[1]);
      const contentLines = tableContent.split('\n');
      let entryIndent = '        '; // default 8 spaces
      for (const line of contentLines) {
        const match = line.match(/^(\s+)\{/);
        if (match) {
          entryIndent = match[1];
          break;
        }
      }

      // Build the insertion text
      const codeToInsert = message.generatedCode.trim();
      const textBeforeBrace = luaCode.substring(0, closingBraceIdx);
      const trimmedBefore = textBeforeBrace.trimEnd();
      const needsComma = !trimmedBefore.endsWith(',') && !trimmedBefore.endsWith('{');

      let newCode: string;
      if (needsComma) {
        const whitespaceAfter = textBeforeBrace.substring(trimmedBefore.length);
        newCode = trimmedBefore + ',\n' + entryIndent + codeToInsert + '\n' + whitespaceAfter.replace(/^\n/, '') + luaCode.substring(closingBraceIdx);
      } else {
        newCode = luaCode.substring(0, closingBraceIdx) + entryIndent + codeToInsert + '\n' + luaCode.substring(closingBraceIdx);
      }

      // Calculate the line number of the inserted code
      let insertedLine: number;
      if (needsComma) {
        insertedLine = trimmedBefore.split('\n').length + 1;
      } else {
        insertedLine = textBeforeBrace.split('\n').length;
      }

      fs.writeFileSync(luaPath, newCode, 'utf-8');
      this.luaLinker.clearCache(luaPath);

      // Send success result back to webview
      webview.postMessage({
        type: 'wizardResult',
        wizardId,
        success: true,
        message: vscode.l10n.t('Successfully inserted new entry into {0}', message.target)
      });

      // Show success with "Jump to Code" option
      const jumpAction = vscode.l10n.t('Jump to Code');
      const userChoice = await vscode.window.showInformationMessage(
        vscode.l10n.t('Successfully inserted new entry into {0}', message.target),
        jumpAction
      );

      if (userChoice === jumpAction) {
        const fileUri = vscode.Uri.file(luaPath);
        const existingColumn = this.findOpenEditorColumn(fileUri);
        const doc = await vscode.workspace.openTextDocument(fileUri);
        const editor = await vscode.window.showTextDocument(doc, {
          viewColumn: existingColumn || vscode.ViewColumn.Beside,
          preserveFocus: false
        });
        const targetLine = Math.max(0, insertedLine - 1);
        const range = new vscode.Range(targetLine, 0, targetLine, doc.lineAt(targetLine).text.length);
        editor.selection = new vscode.Selection(range.start, range.end);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(
        vscode.l10n.t('Wizard execution failed: {0}', errMsg)
      );
      webview.postMessage({ type: 'wizardResult', wizardId, success: false, message: errMsg });
    }
  }

  /**
   * Handle wizard 'run' action — execute shell commands sequentially
   */
  private async handleExecuteWizardRun(
    document: vscode.TextDocument,
    message: { commands?: string; cwd?: string; wizardId?: string },
    webview: vscode.Webview
  ): Promise<void> {
    const wizardId = message.wizardId || '';
    const commandsStr = (message.commands || '').trim();
    if (!commandsStr) {
      vscode.window.showErrorMessage(vscode.l10n.t('No commands to execute'));
      webview.postMessage({ type: 'wizardResult', wizardId, success: false, message: 'No commands to execute' });
      return;
    }

    // Parse commands: split by newline, filter empty/comment lines
    const commands = commandsStr
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'));

    if (commands.length === 0) {
      vscode.window.showErrorMessage(vscode.l10n.t('No commands to execute'));
      webview.postMessage({ type: 'wizardResult', wizardId, success: false, message: 'No commands to execute' });
      return;
    }

    // Determine working directory (resolve relative to markdown file location)
    const mdDir = path.dirname(document.uri.fsPath);
    const cwd = message.cwd
      ? path.resolve(mdDir, message.cwd)
      : mdDir;

    // Confirm execution
    const confirm = await vscode.window.showWarningMessage(
      vscode.l10n.t('Execute {0} command(s) in {1}?', commands.length, cwd),
      { modal: true, detail: commands.join('\n') },
      vscode.l10n.t('Execute')
    );

    if (!confirm) {
      // User cancelled — just restore wizard to preview state
      webview.postMessage({ type: 'wizardResult', wizardId, success: false, message: 'Cancelled by user' });
      return;
    }

    // Create output channel for logging
    const outputChannel = vscode.window.createOutputChannel('Wizard Commands');
    outputChannel.show(true);
    outputChannel.appendLine(`=== ${vscode.l10n.t('Wizard Command Execution')} ===`);
    outputChannel.appendLine(`${vscode.l10n.t('Working directory')}: ${cwd}`);
    outputChannel.appendLine(`${vscode.l10n.t('Commands')}: ${commands.length}`);
    outputChannel.appendLine('');

    // Execute commands sequentially with progress
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: vscode.l10n.t('Executing wizard commands...'),
        cancellable: false,
      },
      async (progress) => {
        let allSuccess = true;
        let failMessage = '';

        for (let i = 0; i < commands.length; i++) {
          const cmd = commands[i];
          progress.report({
            message: `(${i + 1}/${commands.length}) ${cmd}`,
            increment: (100 / commands.length),
          });

          outputChannel.appendLine(`$ ${cmd}`);

          try {
            await new Promise<string>((resolve, reject) => {
              exec(cmd, { cwd, timeout: 60000, encoding: 'utf-8' }, (err: any, stdout: string, stderr: string) => {
                if (stdout) { outputChannel.appendLine(stdout.trimEnd()); }
                if (stderr) { outputChannel.appendLine(stderr.trimEnd()); }
                if (err) {
                  reject(new Error(`Command failed (exit ${err.code}): ${cmd}\n${stderr || err.message}`));
                } else {
                  resolve(stdout);
                }
              });
            });
            outputChannel.appendLine('');
          } catch (error) {
            allSuccess = false;
            const errMsg = error instanceof Error ? error.message : String(error);
            failMessage = errMsg;
            outputChannel.appendLine(`❌ ERROR: ${errMsg}`);
            outputChannel.appendLine('');
            break; // Stop on first failure
          }
        }

        if (allSuccess) {
          outputChannel.appendLine(`✅ ${vscode.l10n.t('All commands completed successfully')}`);
          webview.postMessage({
            type: 'wizardResult',
            wizardId,
            success: true,
            message: vscode.l10n.t('All {0} commands completed successfully!', commands.length)
          });
        } else {
          webview.postMessage({
            type: 'wizardResult',
            wizardId,
            success: false,
            message: failMessage
          });
        }
      }
    );
  }

  /**
   * Render mermaid diagram block.
   * Pre-processes `click NodeId "probe://path#target"` directives into
   * Mermaid callback references so that clicking a node navigates to code.
   */
  private renderMermaidBlock(code: string, index: number, mdDir: string): string {
    // Pre-process probe click directives
    const probeClickMap: Record<string, { file: string; line: number; target: string; fileName: string }> = {};
    const processedCode = this.processMermaidProbeClicks(code, index, mdDir, probeClickMap);

    const escapedCode = this.escapeHtml(processedCode)
      .replace(/\n/g, '&#10;');

    // Attach resolved probe click data as a JSON attribute
    const probeDataAttr = Object.keys(probeClickMap).length > 0
      ? ` data-probe-clicks="${this.escapeHtml(JSON.stringify(probeClickMap))}"`
      : '';

    return `
<div class="mermaid-block">
  <div class="mermaid-header">
    <span class="mermaid-icon">📊</span>
    <span class="mermaid-label">Mermaid Diagram</span>
  </div>
  <div class="mermaid-diagram" id="mermaid-${index}" data-mermaid-code="${escapedCode}"${probeDataAttr}>
    <div class="mermaid-loading">⏳ ${vscode.l10n.t('Rendering diagram...')}</div>
  </div>
</div>`;
  }

  /**
   * Process Mermaid code to extract `click NodeId "probe://path#target"` directives.
   * Resolves each probe URL and replaces the click directive with a Mermaid callback.
   *
   * Supported syntaxes:
   *   click NodeId "probe://./path.lua#target"
   *   click NodeId "probe://./path.lua#target" "tooltip text"
   */
  private processMermaidProbeClicks(
    code: string,
    diagramIndex: number,
    mdDir: string,
    clickMap: Record<string, { file: string; line: number; target: string; fileName: string }>
  ): string {
    // Match click directives with probe:// URLs (quoted)
    const probeClickRegex = /click\s+(\S+)\s+"probe:\/\/([^#"]+)#([^"]+)"(?:\s+"[^"]*")?/g;

    return code.replace(probeClickRegex, (_match, nodeId, filePath, targetName) => {
      const resolved = this.probeScanner.resolveProbe(filePath, targetName, mdDir);
      if (resolved) {
        const fileName = path.basename(filePath);
        // Use raw filePath — JSON.stringify/parse handles backslash escaping automatically.
        // Do NOT double-escape here, otherwise findOpenEditorColumn path comparison fails.
        clickMap[nodeId] = { file: resolved.filePath, line: resolved.line, target: targetName, fileName };
        // Replace with Mermaid callback reference (unique per diagram)
        return `click ${nodeId} mermaidProbe_${diagramIndex}`;
      }
      // Unresolvable — remove the click directive to avoid Mermaid errors
      return '';
    });
  }

  /**
   * Resolve probe:// links in text to webview-clickable HTML links
   * Converts [text](probe://./file.lua#marker) → [text](javascript:void(0)) with onclick handler
   */
  private resolveProbeLinks(text: string, mdDir: string): string {
    const probeLinks = this.probeScanner.findProbeLinks(text);

    // Process in reverse order to preserve indices
    const sortedLinks = [...probeLinks].sort((a, b) => b.matchStart - a.matchStart);

    for (const probeLink of sortedLinks) {
      const target = this.probeScanner.resolveProbe(probeLink.filePath, probeLink.probeName, mdDir);

      let replacement: string;
      if (target) {
        const escapedPath = target.filePath.replace(/\\/g, '\\\\');
        const relPath = path.relative(mdDir, target.filePath).replace(/\\/g, '/');
        const copyContext = `${relPath}:${target.line} (${probeLink.probeName})`;
        replacement = `<span class="probe-link-group"><a class="probe-link" href="javascript:void(0)" onclick="gotoProbe('${escapedPath}', ${target.line})" title="${vscode.l10n.t('Jump to probe "{0}" (Line {1})', probeLink.probeName, target.line)}">📍 ${this.escapeHtml(probeLink.displayText)}</a><span class="probe-copy-btn" onclick="copyContext('${this.escapeHtml(copyContext).replace(/'/g, '\\\'')}')" title="${vscode.l10n.t('Copy reference for AI (Ctrl+V to paste)')}">📋</span></span>`;
      } else {
        replacement = `<span class="probe-link-broken" title="${vscode.l10n.t('Probe "{0}" not found in {1}', probeLink.probeName, probeLink.filePath)}">⚠️ ${this.escapeHtml(probeLink.displayText)}</span>`;
      }

      text = text.substring(0, probeLink.matchStart) + replacement + text.substring(probeLink.matchEnd);
    }

    return text;
  }

  /**
   * Render config control
   */
  private renderConfigControl(block: LinkedConfigBlock): string {
    const statusClass = block.linkStatus === 'ok' ? 'status-ok' : 'status-error';
    const statusIcon = block.linkStatus === 'ok' ? '✅' : '❌';
    const label = block.label || block.key.split('.').pop() || block.key;
    const blockId = this.generateBlockId(block);

    let inputHtml = '';

    if (block.linkStatus === 'ok') {

      switch (block.type) {
        case 'number':
          inputHtml = this.renderNumberInput(block, blockId);
          break;
        case 'slider':
          inputHtml = this.renderSliderInput(block, blockId);
          break;
        case 'boolean':
          inputHtml = this.renderBooleanInput(block, blockId);
          break;
        case 'string':
          inputHtml = this.renderStringInput(block, blockId);
          break;
        case 'select':
          inputHtml = this.renderSelectInput(block, blockId);
          break;
        case 'table':
          inputHtml = this.renderTableInput(block, blockId);
          break;
        case 'code':
          inputHtml = this.renderCodeInput(block, blockId);
          break;
        default:
          inputHtml = this.renderNumberInput(block, blockId);
      }
    } else {
      inputHtml = `<span class="error-message">${block.linkError}</span>`;
    }

    // Build copy context for AI assistant
    const copyContext = block.linkStatus === 'ok'
      ? `[Config] ${block.key} = ${block.type === 'code' ? '(function)' : block.currentValue ?? ''} | File: ${block.file}, Line: ${block.luaNode?.loc.start.line || '?'}`
      : `[Config] ${block.key} | ${block.linkError || 'unlinked'}`;

    return `
<div class="config-block ${statusClass}" data-block-id="${blockId}" data-copy-context="${this.escapeHtml(copyContext)}">
  <div class="config-header">
    <span class="copy-handle" onclick="copyContext(this.closest('.config-block').getAttribute('data-copy-context'))" title="${vscode.l10n.t('Copy as AI context (Ctrl+V to paste)')}">📋</span>
    <span class="status-icon">${statusIcon}</span>
    <span class="config-label">${label}</span>
    <span class="config-key" title="${block.key}">${block.key}</span>
    ${block.linkStatus === 'ok' ? `<button class="goto-btn" onclick="gotoSource('${block.absoluteFilePath.replace(/\\/g, '\\\\')}', ${block.luaNode?.loc.start.line || 1})" title="${vscode.l10n.t('Jump to source')}">📍</button>` : ''}
  </div>
  <div class="config-input">
    ${inputHtml}
  </div>
  ${block.unit ? `<span class="config-unit">${block.unit}</span>` : ''}
</div>`;
  }

  /**
   * Render number input
   */
  private renderNumberInput(block: LinkedConfigBlock, blockId: string): string {
    const min = block.min !== undefined ? `min="${block.min}"` : '';
    const max = block.max !== undefined ? `max="${block.max}"` : '';
    const step = block.step !== undefined ? `step="${block.step}"` : 'step="1"';

    return `
<div class="number-input-wrapper">
  <button class="num-btn minus" onclick="adjustNumber('${blockId}', -1)">−</button>
  <input 
    type="number" 
    id="${blockId}" 
    class="number-input"
    value="${block.currentValue}" 
    ${min} ${max} ${step}
    onchange="updateValue('${blockId}')"
    onkeypress="handleKeyPress(event, '${blockId}')"
  />
  <button class="num-btn plus" onclick="adjustNumber('${blockId}', 1)">+</button>
</div>
${block.min !== undefined && block.max !== undefined ? `<span class="range-hint">${vscode.l10n.t('Range: {0} ~ {1}', block.min, block.max)}</span>` : ''}`;
  }

  /**
   * Render slider input
   */
  private renderSliderInput(block: LinkedConfigBlock, blockId: string): string {
    const min = block.min ?? 0;
    const max = block.max ?? 100;
    const step = block.step ?? 1;
    const value = block.currentValue ?? min;

    return `
<div class="slider-wrapper">
  <input 
    type="range" 
    id="${blockId}" 
    class="slider-input"
    value="${value}" 
    min="${min}" 
    max="${max}" 
    step="${step}"
    oninput="updateSliderDisplay('${blockId}')"
    onchange="updateValue('${blockId}')"
  />
  <div class="slider-labels">
    <span>${min}</span>
    <span class="slider-value" id="${blockId}-display">${value}</span>
    <span>${max}</span>
  </div>
</div>`;
  }

  /**
   * Render boolean input
   */
  private renderBooleanInput(block: LinkedConfigBlock, blockId: string): string {
    const checked = block.currentValue ? 'checked' : '';

    return `
<label class="switch">
  <input 
    type="checkbox" 
    id="${blockId}"
    ${checked}
    onchange="updateValue('${blockId}')"
  />
  <span class="switch-slider"></span>
  <span class="switch-label">${block.currentValue ? vscode.l10n.t('ON') : vscode.l10n.t('OFF')}</span>
</label>`;
  }

  /**
   * Render string input
   */
  private renderStringInput(block: LinkedConfigBlock, blockId: string): string {
    const value = block.currentValue || '';

    return `
<input 
  type="text" 
  id="${blockId}" 
  class="string-input"
  value="${this.escapeHtml(value)}"
  onchange="updateValue('${blockId}')"
  onkeypress="handleKeyPress(event, '${blockId}')"
/>`;
  }

  /**
   * Render select input
   */
  private renderSelectInput(block: LinkedConfigBlock, blockId: string): string {
    const options = block.options || [];
    const currentValue = block.currentValue;

    const optionsHtml = options.map(opt => {
      const selected = opt.value === currentValue || String(opt.value) === String(currentValue) ? 'selected' : '';
      return `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
    }).join('');

    return `
<select id="${blockId}" class="select-input" onchange="updateValue('${blockId}')">
  ${optionsHtml}
</select>`;
  }

  /**
   * Render table input (Tabulator-powered)
   */
  private renderTableInput(block: LinkedConfigBlock, blockId: string): string {
    const t = vscode.l10n.t;
    if (!block.columns || block.columns.length === 0) {
      return `<span class="error-message">${t('Table type requires columns definition')}</span>`;
    }

    // Use already linked table data
    const tableData = block.luaNode?.tableData;

    if (!tableData || tableData.length === 0) {
      return `<div class="table-empty">${t('No data')}</div>`;
    }

    // Render a loading skeleton — actual data will be sent via postMessage (async)
    const rowCount = tableData.length;
    const colCount = block.columns.length;

    // Generate skeleton rows for visual feedback
    let skeletonRows = '';
    const previewRows = Math.min(rowCount, 5);
    for (let r = 0; r < previewRows; r++) {
      skeletonRows += '<div class="skeleton-row">';
      for (let c = 0; c < Math.min(colCount, 6); c++) {
        skeletonRows += '<div class="skeleton-cell"></div>';
      }
      skeletonRows += '</div>';
    }

    return `
<div class="table-wrapper">
  <div class="table-toolbar">
    <span class="table-info">${t('{0} rows', rowCount)}</span>
    <button class="table-filter-btn" onclick="TabulatorGrid.clearFilters('${blockId}-tabulator')" title="${t('Clear all filters')}">🧹 ${t('Clear Filters')}</button>
  </div>
  <div class="tabulator-container deferred-loading" id="${blockId}-tabulator"
    data-block-id="${blockId}">
    <div class="loading-skeleton" id="${blockId}-skeleton">
      <div class="skeleton-header">
        <div class="skeleton-spinner"></div>
        <span>${t('Loading table ({0} rows, {1} columns)...', rowCount, colCount)}</span>
      </div>
      ${skeletonRows}
    </div>
  </div>
</div>`;
  }

  /**
   * Render code input (CodeMirror 6 editor)
   */
  private renderCodeInput(block: LinkedConfigBlock, blockId: string): string {
    const t = vscode.l10n.t;
    const functionSource = block.currentValue || '-- No function found';

    // Indent normalization (cache for async init later)
    const { normalized, baseIndent } = this.normalizeIndentation(functionSource);
    this.codeNormCache.set(blockId, { normalized, baseIndent });

    return `
<div class="code-wrapper">
  <div class="code-modified-hint" id="${blockId}-modified" style="display:none;">
    ⚠️ ${t('Content modified, ready to save')}
  </div>
  <div class="code-toolbar">
    <button class="code-btn code-save-btn" onclick="saveCode('${blockId}')" title="${t('Save changes to source file')}">
      💾 ${t('Save')}
    </button>
    <button class="code-btn code-reset-btn" onclick="resetCode('${blockId}')" title="${t('Reset to original code')}">
      ↩️ ${t('Reset')}
    </button>
    <button class="code-btn code-copy-btn" onclick="copyCodeAsContext('${blockId}')" title="${t('Copy @file reference to clipboard (Ctrl+V to paste into chat)')}">
      📋 ${t('Copy @file')}
    </button>
    ${this.isCursorIDE ? `<button class="code-btn code-ai-btn" onclick="addFileToChat('${blockId}')" title="${t('Add source file to Cursor AI chat as @file reference')}">
      🤖 ${t('Add to Chat')}
    </button>` : ''}
    ${block.linkStatus === 'ok' ? `<button class="code-btn code-goto-btn" onclick="gotoSource('${block.absoluteFilePath.replace(/\\/g, '\\\\')}', ${block.luaNode?.loc.start.line || 1})" title="${t('Jump to function in source file')}">📍 ${t('Go to Source')}</button>` : ''}
  </div>
  <div class="code-cm-container deferred-loading" id="${blockId}-cm">
    <div class="loading-skeleton" id="${blockId}-cm-skeleton">
      <div class="skeleton-header">
        <div class="skeleton-spinner"></div>
        <span>${t('Loading code editor...')}</span>
      </div>
      <div class="skeleton-code-lines">
        <div class="skeleton-code-line" style="width:80%"></div>
        <div class="skeleton-code-line" style="width:60%"></div>
        <div class="skeleton-code-line" style="width:90%"></div>
        <div class="skeleton-code-line" style="width:50%"></div>
        <div class="skeleton-code-line" style="width:70%"></div>
      </div>
    </div>
  </div>
</div>`;
  }

  /**
   * Handle code save: receive normalized code from webview, restore indent and write back to source file
   */
  private async handleSaveCode(
    document: vscode.TextDocument,
    message: { file: string; key: string; code: string; baseIndent: string }
  ): Promise<void> {
    try {
      const mdDir = path.dirname(document.uri.fsPath);
      const luaPath = this.pathResolver.resolve(mdDir, message.file);

      if (!fs.existsSync(luaPath)) {
        vscode.window.showErrorMessage(`文件不存在: ${luaPath}`);
        return;
      }

      // Reparse source file to get current function range
      const luaCode = fs.readFileSync(luaPath, 'utf-8');
      const parser = new LuaParser(luaCode);
      const result = parser.findFunctionByFullPath(message.key);

      if (!result.success || !result.node) {
        vscode.window.showErrorMessage(vscode.l10n.t('Function {0} not found in source file', message.key));
        return;
      }

      // Restore indent: recover normalized code to original indentation
      const restoredCode = this.denormalizeIndentation(message.code, message.baseIndent || '');

      // Precise replacement: only replace function part, preserve all other content
      const before = luaCode.substring(0, result.node.range[0]);
      const after = luaCode.substring(result.node.range[1]);
      const newCode = before + restoredCode + after;

      // Write source file
      fs.writeFileSync(luaPath, newCode, 'utf-8');

      // Clear cache
      this.luaLinker.clearCache(luaPath);

      vscode.window.showInformationMessage(vscode.l10n.t('Saved {0}', message.key));
    } catch (error) {
      vscode.window.showErrorMessage(
        vscode.l10n.t('Save failed: {0}', error instanceof Error ? error.message : String(error))
      );
    }
  }

  /**
   * Simple Markdown to HTML
   * More compact layout, avoid excessive blank lines
   */
  private simpleMarkdownToHtml(text: string): string {
    // Split text by lines for processing
    const lines = text.split('\n');
    const result: string[] = [];
    let inBlockquote = false;
    let blockquoteLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 跳过占位符周围的空行
      if (line.trim() === '' && 
          (result.length > 0 && (result[result.length - 1].includes('__CONFIG_BLOCK_PLACEHOLDER_') || result[result.length - 1].includes('__MERMAID_BLOCK_PLACEHOLDER_')))) {
        continue;
      }
      if (line.trim() === '' && 
          i + 1 < lines.length && (lines[i + 1].includes('__CONFIG_BLOCK_PLACEHOLDER_') || lines[i + 1].includes('__MERMAID_BLOCK_PLACEHOLDER_'))) {
        continue;
      }

      // 处理引用块（可能跨多行）
      if (line.startsWith('> ')) {
        if (!inBlockquote) {
          inBlockquote = true;
          blockquoteLines = [];
        }
        blockquoteLines.push(line.slice(2));
        continue;
      } else if (inBlockquote) {
        // 结束引用块
        result.push(`<blockquote>${blockquoteLines.join('<br>')}</blockquote>`);
        inBlockquote = false;
        blockquoteLines = [];
      }

      // 标题 (with slug-based id for scroll targeting)
      if (line.startsWith('### ')) {
        const text = line.slice(4);
        const slug = this.slugify(text);
        result.push(`<h3 id="${slug}">${this.processInlineMarkdown(text)}</h3>`);
        continue;
      }
      if (line.startsWith('## ')) {
        const text = line.slice(3);
        const slug = this.slugify(text);
        result.push(`<h2 id="${slug}">${this.processInlineMarkdown(text)}</h2>`);
        continue;
      }
      if (line.startsWith('# ')) {
        const text = line.slice(2);
        const slug = this.slugify(text);
        result.push(`<h1 id="${slug}">${this.processInlineMarkdown(text)}</h1>`);
        continue;
      }

      // 占位符直接输出
      if (line.includes('__CONFIG_BLOCK_PLACEHOLDER_') || line.includes('__MERMAID_BLOCK_PLACEHOLDER_')) {
        result.push(line);
        continue;
      }

      // 空行只在必要时添加段落分隔
      if (line.trim() === '') {
        // 只有当上一行不是块级元素时才添加空行
        const lastLine = result[result.length - 1] || '';
        if (lastLine && 
            !lastLine.endsWith('</h1>') && 
            !lastLine.endsWith('</h2>') && 
            !lastLine.endsWith('</h3>') && 
            !lastLine.endsWith('</blockquote>') &&
            !lastLine.includes('__CONFIG_BLOCK_PLACEHOLDER_') &&
            !lastLine.includes('__MERMAID_BLOCK_PLACEHOLDER_')) {
          result.push('<br>');
        }
        continue;
      }

      // 普通段落
      result.push(`<p>${this.processInlineMarkdown(line)}</p>`);
    }

    // 处理末尾的引用块
    if (inBlockquote && blockquoteLines.length > 0) {
      result.push(`<blockquote>${blockquoteLines.join('<br>')}</blockquote>`);
    }

    return result.join('\n');
  }

  /**
   * Process inline Markdown syntax
   */
  private processInlineMarkdown(text: string): string {
    return text
      // 粗体
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // 斜体
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // 代码
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  /**
   * Generate a URL-friendly slug from heading text (GitHub-style).
   * Strips HTML, emoji, lowercases, replaces spaces/special with hyphens.
   */
  private slugify(text: string): string {
    return text
      // Remove inline markdown (bold, italic, code)
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      // Remove emoji (Unicode emoji range)
      .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .trim()
      .toLowerCase()
      // Replace non-alphanumeric (keep CJK, letters, digits) with hyphens
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      // Remove leading/trailing hyphens
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Generate block ID
   */
  private generateBlockId(block: LinkedConfigBlock): string {
    return `block-${block.key.replace(/\./g, '-').replace(/\[|\]/g, '_')}`;
  }

  /**
   * Format value
   */
  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return 'nil';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * HTML escape
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Get styles - based on GitHub Markdown style
   */
  private getStyles(): string {
    return `
      /* ========== VS Code 变量 ========== */
      :root {
        --color-fg-default: var(--vscode-editor-foreground);
        --color-fg-muted: var(--vscode-descriptionForeground, #656d76);
        --color-canvas-default: var(--vscode-editor-background);
        --color-canvas-subtle: var(--vscode-editorWidget-background, rgba(128,128,128,0.05));
        --color-border-default: var(--vscode-panel-border, rgba(128,128,128,0.2));
        --color-border-muted: var(--vscode-editorWidget-border, rgba(128,128,128,0.15));
        --color-accent: var(--vscode-focusBorder, #0969da);
        --color-link: var(--vscode-textLink-foreground, #3794ff);
        --color-link-active: var(--vscode-textLink-activeForeground, #3794ff);
        --color-success: #1a7f37;
        --color-danger: #cf222e;
        --input-bg: var(--vscode-input-background);
        --input-fg: var(--vscode-input-foreground);
        --input-border: var(--vscode-input-border, rgba(128,128,128,0.3));
        --button-bg: var(--vscode-button-background);
        --button-fg: var(--vscode-button-foreground);
      }

      /* ========== 基础样式 (GitHub Markdown 风格) ========== */
      *, *::before, *::after {
        box-sizing: border-box;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: var(--color-fg-default);
        background: var(--color-canvas-default);
        margin: 0;
        padding: 0;
        word-wrap: break-word;
      }

      .container {
        max-width: 980px;
        margin: 0 auto;
        padding: 16px 32px 32px;
      }

      /* ========== 工具栏 ========== */
      .toolbar {
        position: sticky;
        top: 0;
        background: var(--color-canvas-default);
        padding: 8px 0;
        margin-bottom: 16px;
        border-bottom: 1px solid var(--color-border-muted);
        z-index: 100;
        display: flex;
        gap: 8px;
      }

      .toolbar button {
        background: var(--button-bg);
        color: var(--button-fg);
        border: none;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: opacity 0.1s;
      }

      .toolbar button:hover {
        opacity: 0.85;
      }

      /* ========== 排版 (VS Code Markdown 风格 - 更紧凑) ========== */
      .content { line-height: 1.6; }
      .content > p:first-child { margin-top: 0; }
      .content > br:first-child { display: none; }

      h1, h2, h3, h4, h5, h6 {
        margin-top: 16px;
        margin-bottom: 8px;
        font-weight: 600;
        line-height: 1.3;
      }

      h1 { 
        font-size: 1.8em; 
        padding-bottom: 0.2em;
        border-bottom: 1px solid var(--color-border-muted);
        margin-top: 0;
      }

      h2 { 
        font-size: 1.4em; 
        padding-bottom: 0.2em;
        border-bottom: 1px solid var(--color-border-muted);
      }

      h3 { font-size: 1.17em; margin-top: 12px; }
      h4 { font-size: 1em; margin-top: 10px; }

      p { 
        margin-top: 0; 
        margin-bottom: 8px; 
        line-height: 1.5;
      }

      br { 
        display: block;
        content: "";
        margin-top: 4px;
      }

      blockquote {
        margin: 8px 0;
        padding: 2px 12px;
        color: var(--color-fg-muted);
        border-left: 3px solid var(--color-border-default);
      }

      blockquote p {
        margin: 0;
      }

      code {
        padding: 0.2em 0.4em;
        margin: 0;
        font-size: 85%;
        white-space: break-spaces;
        background-color: var(--color-canvas-subtle);
        border-radius: 6px;
        font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
      }

      strong { font-weight: 600; }
      em { font-style: italic; }

      hr {
        height: 0.25em;
        padding: 0;
        margin: 24px 0;
        background-color: var(--color-border-muted);
        border: 0;
      }

      /* ========== 配置块样式 ========== */
      .config-block {
        position: relative;
        background: var(--color-canvas-subtle);
        border: 1px solid var(--color-border-muted);
        border-radius: 6px;
        padding: 10px 14px;
        margin: 8px 0;
        transition: border-color 0.15s, box-shadow 0.15s;
      }

      .config-block:hover {
        border-color: var(--color-accent);
      }

      .config-block.status-error {
        border-color: var(--color-danger);
        background: rgba(207, 34, 46, 0.04);
      }

      .config-header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 6px;
      }

      .status-icon { font-size: 14px; line-height: 1; }

      .config-label {
        font-weight: 600;
        font-size: 14px;
        color: var(--color-fg-default);
      }

      .config-key {
        font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
        font-size: 11px;
        color: var(--color-fg-muted);
        background: rgba(128, 128, 128, 0.1);
        padding: 2px 6px;
        border-radius: 4px;
        margin-left: auto;
      }

      .goto-btn {
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 2px 4px;
        border-radius: 4px;
        opacity: 0.5;
        font-size: 12px;
        transition: opacity 0.15s, background 0.15s;
      }

      .goto-btn:hover {
        opacity: 1;
        background: rgba(128, 128, 128, 0.15);
      }

      /* ========== Copy-as-context handles ========== */
      .copy-handle {
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 1px 4px;
        border-radius: 3px;
        opacity: 0.35;
        font-size: 12px;
        line-height: 1;
        transition: opacity 0.15s, background 0.15s, transform 0.1s;
      }

      .copy-handle:hover {
        opacity: 1;
        background: rgba(9, 105, 218, 0.12);
        transform: scale(1.15);
      }

      .copy-handle:active {
        transform: scale(0.95);
      }

      .probe-link-group {
        display: inline-flex;
        align-items: center;
        gap: 2px;
      }

      .probe-copy-btn {
        cursor: pointer;
        font-size: 11px;
        padding: 0 3px;
        opacity: 0;
        transition: opacity 0.15s, transform 0.1s;
        vertical-align: middle;
        line-height: 1;
      }

      .probe-link-group:hover .probe-copy-btn {
        opacity: 0.5;
      }

      .probe-copy-btn:hover {
        opacity: 1 !important;
        transform: scale(1.2);
      }

      .probe-copy-btn:active {
        transform: scale(0.9);
      }

      .config-input {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .config-unit {
        font-size: 12px;
        color: var(--color-fg-muted);
      }

      .error-message {
        color: var(--color-danger);
        font-size: 12px;
      }

      .range-hint {
        font-size: 11px;
        color: var(--color-fg-muted);
      }

      /* ========== 数字输入控件 ========== */
      .number-input-wrapper {
        display: inline-flex;
        align-items: center;
        border: 1px solid var(--input-border);
        border-radius: 6px;
        overflow: hidden;
        background: var(--input-bg);
      }

      .number-input-wrapper:focus-within {
        border-color: var(--color-accent);
        box-shadow: 0 0 0 2px rgba(9, 105, 218, 0.15);
      }

      .number-input {
        width: 80px;
        padding: 4px 8px;
        border: none;
        background: transparent;
        color: var(--input-fg);
        font-size: 13px;
        font-weight: 500;
        text-align: center;
        -moz-appearance: textfield;
      }

      .number-input::-webkit-outer-spin-button,
      .number-input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }

      .number-input:focus { outline: none; }

      .num-btn {
        width: 28px;
        height: 28px;
        border: none;
        background: transparent;
        color: var(--color-fg-muted);
        font-size: 16px;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.1s, color 0.1s;
      }

      .num-btn:hover {
        background: rgba(128, 128, 128, 0.15);
        color: var(--color-fg-default);
      }

      .num-btn:active { background: rgba(128, 128, 128, 0.25); }

      .num-btn.minus { border-right: 1px solid var(--input-border); }
      .num-btn.plus { border-left: 1px solid var(--input-border); }

      /* ========== 滑动条控件 ========== */
      .slider-wrapper {
        flex: 1;
        max-width: 280px;
        min-width: 180px;
      }

      .slider-input {
        width: 100%;
        height: 6px;
        border-radius: 3px;
        background: rgba(128, 128, 128, 0.2);
        outline: none;
        -webkit-appearance: none;
        cursor: pointer;
      }

      .slider-input::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--color-accent);
        cursor: pointer;
        border: 2px solid var(--color-canvas-default);
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        transition: transform 0.1s;
      }

      .slider-input::-webkit-slider-thumb:hover {
        transform: scale(1.15);
      }

      .slider-input::-moz-range-thumb {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--color-accent);
        cursor: pointer;
        border: 2px solid var(--color-canvas-default);
      }

      .slider-labels {
        display: flex;
        justify-content: space-between;
        margin-top: 4px;
        font-size: 11px;
        color: var(--color-fg-muted);
      }

      .slider-value {
        font-weight: 600;
        font-size: 13px;
        color: var(--color-accent);
        min-width: 50px;
        text-align: center;
      }

      /* ========== 开关控件 ========== */
      .switch {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        user-select: none;
      }

      .switch input { display: none; }

      .switch-slider {
        width: 40px;
        height: 22px;
        background: rgba(128, 128, 128, 0.3);
        border-radius: 11px;
        position: relative;
        transition: background 0.2s;
      }

      .switch-slider::after {
        content: '';
        position: absolute;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: white;
        top: 2px;
        left: 2px;
        transition: transform 0.2s;
        box-shadow: 0 1px 2px rgba(0,0,0,0.2);
      }

      .switch input:checked + .switch-slider {
        background: var(--color-success);
      }

      .switch input:checked + .switch-slider::after {
        transform: translateX(18px);
      }

      .switch-label {
        font-size: 13px;
        color: var(--color-fg-muted);
      }

      /* ========== 文本输入框 ========== */
      .string-input {
        flex: 1;
        max-width: 300px;
        padding: 4px 10px;
        border: 1px solid var(--input-border);
        border-radius: 6px;
        background: var(--input-bg);
        color: var(--input-fg);
        font-size: 13px;
        transition: border-color 0.15s, box-shadow 0.15s;
      }

      .string-input:focus {
        outline: none;
        border-color: var(--color-accent);
        box-shadow: 0 0 0 2px rgba(9, 105, 218, 0.15);
      }

      /* ========== 下拉选择框 ========== */
      .select-input {
        min-width: 160px;
        padding: 4px 10px;
        border: 1px solid var(--input-border);
        border-radius: 6px;
        background: var(--input-bg);
        color: var(--input-fg);
        font-size: 13px;
        cursor: pointer;
        transition: border-color 0.15s, box-shadow 0.15s;
      }

      .select-input:focus {
        outline: none;
        border-color: var(--color-accent);
        box-shadow: 0 0 0 2px rgba(9, 105, 218, 0.15);
      }

      /* ========== 表格样式 (Tabulator) ========== */
      .table-wrapper {
        width: 100%;
        overflow-x: auto;
        margin: 8px 0;
      }

      .table-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 4px 0;
        margin-bottom: 4px;
      }

      .table-info {
        font-size: 12px;
        color: var(--color-fg-muted);
      }

      .table-filter-btn {
        padding: 3px 10px;
        font-size: 12px;
        border: 1px solid var(--color-border-default);
        border-radius: 4px;
        background: var(--color-canvas-subtle);
        color: var(--color-fg-default);
        cursor: pointer;
        transition: background 0.15s;
      }
      .table-filter-btn:hover {
        background: var(--color-canvas-default);
      }

      .table-empty {
        padding: 24px;
        text-align: center;
        color: var(--color-fg-muted);
        font-size: 13px;
      }

      /* Tabulator VS Code theme overrides */
      .tabulator {
        font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif) !important;
        font-size: 13px !important;
        border: 1px solid var(--color-border-muted) !important;
        border-radius: 6px !important;
        background-color: var(--color-canvas-default) !important;
        overflow: hidden;
      }
      .tabulator .tabulator-header {
        background-color: var(--color-canvas-subtle) !important;
        border-bottom: 2px solid var(--color-border-default) !important;
        color: var(--color-fg-default) !important;
      }
      .tabulator .tabulator-header .tabulator-col {
        background-color: transparent !important;
        border-right: 1px solid var(--color-border-muted) !important;
      }
      .tabulator .tabulator-header .tabulator-col .tabulator-col-content {
        color: var(--color-fg-default) !important;
      }
      .tabulator .tabulator-header .tabulator-col .tabulator-col-title {
        color: var(--color-fg-default) !important;
        font-weight: 600;
      }
      .tabulator .tabulator-header .tabulator-col.tabulator-sortable .tabulator-col-title {
        padding-right: 20px;
      }
      .tabulator .tabulator-header .tabulator-col .tabulator-header-filter input {
        background: var(--input-bg) !important;
        color: var(--input-fg) !important;
        border: 1px solid var(--input-border) !important;
        border-radius: 3px !important;
        padding: 2px 6px !important;
        font-size: 12px !important;
      }
      .tabulator .tabulator-header .tabulator-col .tabulator-header-filter input:focus {
        border-color: var(--color-accent) !important;
        outline: none !important;
      }
      .tabulator .tabulator-header .tabulator-col .tabulator-header-filter select {
        background: var(--input-bg) !important;
        color: var(--input-fg) !important;
        border: 1px solid var(--input-border) !important;
        border-radius: 3px !important;
        padding: 2px 6px !important;
        font-size: 12px !important;
      }
      .tabulator .tabulator-tableholder {
        background-color: var(--color-canvas-default) !important;
        max-height: 400px;
        overflow: auto !important;
      }
      .tabulator-row {
        background-color: var(--color-canvas-default) !important;
        border-bottom: 1px solid var(--color-border-muted) !important;
        color: var(--color-fg-default) !important;
        min-height: 32px !important;
      }
      .tabulator-row:hover {
        background-color: var(--color-canvas-subtle) !important;
      }
      .tabulator-row.tabulator-row-even {
        background-color: var(--color-canvas-default) !important;
      }
      .tabulator-row.tabulator-row-even:hover {
        background-color: var(--color-canvas-subtle) !important;
      }
      .tabulator-row .tabulator-cell {
        border-right: 1px solid var(--color-border-muted) !important;
        color: var(--color-fg-default) !important;
        padding: 6px 10px !important;
      }
      .tabulator-row .tabulator-cell.tabulator-editing {
        border: 1px solid var(--color-accent) !important;
        padding: 0 !important;
      }
      .tabulator-row .tabulator-cell.tabulator-editing input,
      .tabulator-row .tabulator-cell.tabulator-editing select {
        background: var(--input-bg) !important;
        color: var(--input-fg) !important;
        border: none !important;
        padding: 6px 10px !important;
        font-size: 13px !important;
      }
      .tabulator .tabulator-footer {
        background-color: var(--color-canvas-subtle) !important;
        border-top: 1px solid var(--color-border-default) !important;
        color: var(--color-fg-muted) !important;
      }
      .tabulator .tabulator-placeholder {
        color: var(--color-fg-muted) !important;
        background: var(--color-canvas-default) !important;
      }
      .tabulator .tabulator-col-resize-handle {
        width: 6px;
      }
      /* Sort arrows */
      .tabulator .tabulator-header .tabulator-col.tabulator-sortable[aria-sort="ascending"] .tabulator-col-sorter .tabulator-arrow {
        border-bottom-color: var(--color-accent) !important;
      }
      .tabulator .tabulator-header .tabulator-col.tabulator-sortable[aria-sort="descending"] .tabulator-col-sorter .tabulator-arrow {
        border-top-color: var(--color-accent) !important;
      }

      /* Goto source button in table rows */
      .tabulator-goto-col {
        padding: 2px 4px !important;
      }
      .tabulator-goto-btn {
        cursor: pointer;
        font-size: 14px;
        opacity: 0.5;
        transition: opacity 0.15s;
        display: inline-block;
        line-height: 1;
      }
      .tabulator-row:hover .tabulator-goto-btn {
        opacity: 1;
      }
      .tabulator-goto-btn:hover {
        opacity: 1;
        transform: scale(1.2);
      }

      /* ========== 代码编辑控件 ========== */
      .code-wrapper {
        width: 100%;
        margin: 4px 0;
      }

      /* 修改提示 */
      .code-modified-hint {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 5px 10px;
        margin-bottom: 6px;
        font-size: 12px;
        font-weight: 500;
        color: var(--vscode-editorWarning-foreground, #cca700);
        background: rgba(204, 167, 0, 0.08);
        border-radius: 6px;
        border-left: 3px solid var(--vscode-editorWarning-foreground, #cca700);
      }

      .code-toolbar {
        display: flex;
        gap: 8px;
        margin-bottom: 6px;
      }

      .code-btn {
        padding: 4px 10px;
        border: 1px solid var(--input-border);
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
      }

      .code-save-btn {
        background: var(--button-bg);
        color: var(--button-fg);
        border-color: transparent;
      }

      .code-save-btn:hover { opacity: 0.85; }

      .code-reset-btn {
        background: var(--color-canvas-subtle);
        color: var(--color-fg-default);
      }

      .code-reset-btn:hover {
        border-color: var(--color-danger);
        background: rgba(207, 34, 46, 0.08);
      }

      .code-goto-btn {
        background: var(--color-canvas-subtle);
        color: var(--color-fg-default);
      }

      .code-goto-btn:hover {
        border-color: var(--color-accent);
        background: rgba(9, 105, 218, 0.08);
      }

      .code-copy-btn {
        background: var(--color-canvas-subtle);
        color: var(--color-fg-default);
      }

      .code-copy-btn:hover {
        border-color: var(--color-accent);
        background: rgba(9, 105, 218, 0.08);
      }

      .code-ai-btn {
        background: rgba(130, 80, 223, 0.1);
        color: var(--color-fg-default);
        border-color: rgba(130, 80, 223, 0.3);
      }

      .code-ai-btn:hover {
        border-color: rgba(130, 80, 223, 0.6);
        background: rgba(130, 80, 223, 0.2);
      }

      /* CodeMirror 容器 */
      .code-cm-container {
        width: 100%;
        border: 1px solid var(--input-border);
        border-radius: 6px;
        overflow: hidden;
        transition: border-color 0.15s, box-shadow 0.15s;
      }

      .code-cm-container:focus-within {
        border-color: var(--color-accent);
        box-shadow: 0 0 0 2px rgba(9, 105, 218, 0.15);
      }

      /* CodeMirror 样式覆盖 */
      .code-cm-container .cm-editor {
        max-height: 600px;
        outline: none;
      }

      .code-cm-container .cm-editor.cm-focused {
        outline: none;
      }

      .code-cm-container .cm-scroller {
        overflow: auto;
        font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
        font-size: 12px;
        line-height: 1.6;
      }

      /* ========== Probe 链接样式 ========== */
      .probe-link {
        color: var(--color-link);
        text-decoration: none;
        cursor: pointer;
        border-bottom: 1px dashed var(--color-link);
        padding-bottom: 1px;
        transition: color 0.15s, border-color 0.15s;
      }

      .probe-link:hover {
        color: var(--color-link-active);
        border-bottom-style: solid;
        border-bottom-color: var(--color-link-active);
      }

      .probe-link-broken {
        color: var(--color-danger);
        text-decoration: line-through;
        opacity: 0.7;
        cursor: help;
      }

      /* ========== Mermaid 图表样式 ========== */
      .mermaid-block {
        position: relative;
        background: var(--color-canvas-subtle);
        border: 1px solid var(--color-border-muted);
        border-radius: 6px;
        padding: 10px 14px;
        margin: 8px 0;
        transition: border-color 0.15s;
      }

      .mermaid-block:hover {
        border-color: var(--color-accent);
      }

      .mermaid-header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 8px;
      }

      .mermaid-icon {
        font-size: 14px;
        line-height: 1;
      }

      .mermaid-label {
        font-weight: 600;
        font-size: 13px;
        color: var(--color-fg-muted);
      }

      .mermaid-diagram {
        width: 100%;
        overflow-x: auto;
        display: flex;
        justify-content: center;
        padding: 8px 0;
      }

      .mermaid-diagram svg {
        max-width: 100%;
        height: auto;
      }

      .mermaid-loading {
        padding: 16px;
        text-align: center;
        color: var(--color-fg-muted);
        font-size: 13px;
      }

      .mermaid-error .mermaid-error-msg {
        padding: 12px;
        color: var(--color-danger);
        background: rgba(207, 34, 46, 0.06);
        border-radius: 4px;
        font-size: 12px;
        font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
        white-space: pre-wrap;
        word-break: break-word;
      }

      /* ========== 更新动画 ========== */
      @keyframes flash {
        0% { background-color: rgba(26, 127, 55, 0.15); }
        100% { background-color: var(--color-canvas-subtle); }
      }

      .config-block.updated {
        animation: flash 0.6s ease-out;
      }

      /* ========== Scroll highlight animation ========== */
      @keyframes scrollHighlight {
        0% { background-color: rgba(55, 148, 255, 0.25); }
        100% { background-color: transparent; }
      }

      .scroll-highlight {
        animation: scrollHighlight 2s ease-out;
        border-radius: 4px;
        scroll-margin-top: 60px;
      }

      /* Add scroll-margin to all headings for sticky toolbar offset */
      h1[id], h2[id], h3[id] {
        scroll-margin-top: 60px;
      }

      /* ========== Copy toast ========== */
      .copy-toast {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%) translateY(10px);
        background: var(--color-fg-default);
        color: var(--color-canvas-default);
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 13px;
        opacity: 0;
        transition: opacity 0.3s, transform 0.3s;
        z-index: 9999;
        pointer-events: none;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .copy-toast.show {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }

      .copy-toast .toast-hint {
        font-size: 11px;
        opacity: 0.7;
        border-left: 1px solid rgba(128,128,128,0.3);
        padding-left: 8px;
      }

      .copy-toast kbd {
        background: rgba(128,128,128,0.2);
        border-radius: 3px;
        padding: 1px 4px;
        font-size: 11px;
        font-family: ui-monospace, monospace;
      }

      /* ========== Wizard Block ========== */
      /* ========== Loading Skeleton & Progressive Loading ========== */
      .loading-skeleton {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .skeleton-header {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: var(--color-fg-muted);
        margin-bottom: 8px;
      }
      .skeleton-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(128,128,128,0.3);
        border-top: 2px solid var(--vscode-button-background, #0078d4);
        border-radius: 50%;
        animation: skeletonSpin 0.8s linear infinite;
      }
      @keyframes skeletonSpin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .skeleton-row {
        display: flex;
        gap: 8px;
        height: 24px;
      }
      .skeleton-cell {
        flex: 1;
        background: linear-gradient(90deg, rgba(128,128,128,0.1) 25%, rgba(128,128,128,0.2) 50%, rgba(128,128,128,0.1) 75%);
        background-size: 200% 100%;
        animation: skeletonShimmer 1.5s ease-in-out infinite;
        border-radius: 4px;
      }
      @keyframes skeletonShimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      .skeleton-code-lines {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px 0;
      }
      .skeleton-code-line {
        height: 14px;
        background: linear-gradient(90deg, rgba(128,128,128,0.1) 25%, rgba(128,128,128,0.2) 50%, rgba(128,128,128,0.1) 75%);
        background-size: 200% 100%;
        animation: skeletonShimmer 1.5s ease-in-out infinite;
        border-radius: 3px;
      }
      .deferred-loading {
        min-height: 80px;
      }
      .block-loaded {
        animation: blockFadeIn 0.3s ease-out;
      }
      @keyframes blockFadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .wizard-block {
        border: 2px solid var(--vscode-button-background, var(--color-accent));
        border-radius: 10px;
        margin: 16px 0;
        overflow: hidden;
        background: var(--color-canvas-subtle);
      }

      .wizard-header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 16px;
        background: var(--vscode-button-background, var(--color-accent));
        color: var(--vscode-button-foreground, #fff);
        font-weight: 600;
        font-size: 15px;
      }

      .wizard-icon { font-size: 20px; }

      .wizard-title { flex: 1; }

      .wizard-target {
        font-size: 11px;
        opacity: 0.85;
        font-weight: 400;
        font-family: ui-monospace, monospace;
        background: rgba(255,255,255,0.18);
        padding: 2px 8px;
        border-radius: 4px;
      }

      /* Progress bar */
      .wizard-progress {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0;
        padding: 12px 16px;
        border-bottom: 1px solid var(--color-border-muted);
        background: var(--color-canvas-default);
      }

      .wizard-progress-dot {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 600;
        background: var(--color-canvas-default);
        border: 2px solid var(--color-border-default);
        color: var(--color-fg-muted);
        transition: all 0.3s;
        flex-shrink: 0;
      }

      .wizard-progress-dot.active {
        background: var(--vscode-button-background, var(--color-accent));
        border-color: var(--vscode-button-background, var(--color-accent));
        color: var(--vscode-button-foreground, #fff);
        transform: scale(1.1);
      }

      .wizard-progress-dot.done {
        background: var(--vscode-testing-iconPassed, #2ea043);
        border-color: var(--vscode-testing-iconPassed, #2ea043);
        color: #fff;
      }

      .wizard-progress-line {
        height: 2px;
        width: 32px;
        background: var(--color-border-default);
        flex-shrink: 0;
      }

      .wizard-progress-line.done {
        background: var(--vscode-testing-iconPassed, #2ea043);
      }

      /* Wizard body */
      .wizard-body {
        padding: 16px;
      }

      .wizard-step {
        animation: wizardFadeIn 0.3s ease;
      }

      @keyframes wizardFadeIn {
        from { opacity: 0; transform: translateX(20px); }
        to { opacity: 1; transform: translateX(0); }
      }

      .wizard-step-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
      }

      .wizard-step-badge {
        background: var(--vscode-badge-background, var(--color-accent));
        color: var(--vscode-badge-foreground, #fff);
        padding: 2px 10px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        white-space: nowrap;
      }

      .wizard-step-title {
        font-size: 16px;
        font-weight: 600;
        color: var(--color-fg-default);
      }

      .wizard-step-desc {
        color: var(--color-fg-muted);
        font-size: 13px;
        margin-bottom: 12px;
        padding-left: 2px;
      }

      .wizard-step-input {
        margin-bottom: 16px;
      }

      .wizard-input {
        width: 100%;
        padding: 8px 12px;
        background: var(--input-bg);
        color: var(--input-fg);
        border: 1px solid var(--input-border);
        border-radius: 6px;
        font-size: 14px;
        font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
        outline: none;
        transition: border-color 0.2s;
      }

      .wizard-input:focus {
        border-color: var(--vscode-focusBorder, var(--color-accent));
        box-shadow: 0 0 0 2px rgba(var(--vscode-focusBorder, 9, 105, 218), 0.25);
      }

      .wizard-checkbox {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        font-size: 14px;
        padding: 8px 0;
        color: var(--color-fg-default);
      }

      .wizard-checkbox input[type="checkbox"] {
        width: 18px;
        height: 18px;
        accent-color: var(--vscode-button-background, var(--color-accent));
        cursor: pointer;
      }

      .wizard-step-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        padding-top: 8px;
      }

      .wizard-btn {
        padding: 8px 20px;
        border: none;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .wizard-btn:hover { opacity: 0.9; transform: translateY(-1px); }
      .wizard-btn:active { transform: translateY(0); }

      .wizard-btn-primary {
        background: var(--vscode-button-background, var(--color-accent));
        color: var(--vscode-button-foreground, #fff);
      }

      .wizard-btn-secondary {
        background: var(--color-canvas-default);
        color: var(--color-fg-default);
        border: 1px solid var(--color-border-default);
      }

      .wizard-btn-success {
        background: var(--vscode-testing-iconPassed, #2ea043);
        color: #fff;
      }

      /* Preview area */
      .wizard-preview {
        animation: wizardFadeIn 0.3s ease;
      }

      .wizard-preview-header {
        font-size: 13px;
        font-weight: 600;
        color: var(--color-fg-muted);
        margin-bottom: 8px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .wizard-preview-code {
        background: var(--input-bg);
        border: 1px solid var(--input-border);
        border-radius: 6px;
        padding: 12px;
        font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
        font-size: 13px;
        line-height: 1.5;
        overflow-x: auto;
        color: var(--color-fg-default);
        margin-bottom: 12px;
        white-space: pre;
      }

      /* Wizard result states */
      .wizard-result {
        display: none;
        text-align: center;
        padding: 24px 16px;
      }
      .wizard-result-icon {
        font-size: 48px;
        margin-bottom: 12px;
      }
      .wizard-result-title {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 8px;
        color: var(--color-fg-default);
      }
      .wizard-result-detail {
        font-size: 13px;
        color: var(--color-fg-muted);
        margin-bottom: 16px;
        word-break: break-word;
        max-height: 120px;
        overflow-y: auto;
        padding: 8px;
        background: rgba(128, 128, 128, 0.1);
        border-radius: 6px;
        text-align: left;
        font-family: var(--vscode-editor-font-family), monospace;
        white-space: pre-wrap;
      }
      .wizard-result-actions {
        margin-top: 16px;
      }
      .wizard-result-executing .wizard-result-icon {
        animation: wizardSpin 1.5s linear infinite;
      }
      .wizard-result-success .wizard-result-title {
        color: var(--vscode-testing-iconPassed, #2ea043);
      }
      .wizard-result-error .wizard-result-title {
        color: var(--vscode-errorForeground, #f85149);
      }
      .wizard-result-error .wizard-result-detail {
        background: rgba(248, 81, 73, 0.1);
        border: 1px solid rgba(248, 81, 73, 0.3);
      }
      @keyframes wizardSpin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
  }

  /**
   * Get script
   */
  private getScript(linkedBlocks: LinkedConfigBlock[], _wizardBlocks: ParsedWizardBlock[] = []): string {
    // Create block data mapping (including code block normalization info)
    const blockDataMap: Record<string, any> = {};
    for (const block of linkedBlocks) {
      const blockId = this.generateBlockId(block);
      const normData = this.codeNormCache.get(blockId);
      // Compute workspace-relative path for @file references
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
      const wsRelPath = block.absoluteFilePath && workspaceRoot
        ? path.relative(workspaceRoot, block.absoluteFilePath).replace(/\\/g, '/')
        : block.file || '';

      blockDataMap[blockId] = {
        file: block.file,
        key: block.key,
        type: block.type,
        min: block.min,
        max: block.max,
        step: block.step || 1,
        lang: block.type === 'code' ? this.getLanguageFromFile(block.absoluteFilePath) : undefined,
        baseIndent: normData?.baseIndent || '',
        originalCode: normData?.normalized || '',
        absoluteFilePath: block.absoluteFilePath || '',
        workspaceRelativePath: wsRelPath,
        startLine: block.luaNode?.loc.start.line || 0,
        endLine: block.luaNode?.loc.end.line || 0,
      };
    }

    return `
      const vscode = acquireVsCodeApi();
      const blockData = ${JSON.stringify(blockDataMap)};

      /* ========== 通用控件函数 ========== */
      function updateValue(blockId) {
        const input = document.getElementById(blockId);
        const data = blockData[blockId];
        if (!input || !data) return;

        let value;
        if (input.type === 'checkbox') {
          value = input.checked;
          const label = input.closest('.switch').querySelector('.switch-label');
          if (label) label.textContent = value ? 'ON' : 'OFF';
        } else if (input.type === 'number' || input.type === 'range') {
          value = parseFloat(input.value);
          if (isNaN(value)) return;
          if (data.min !== undefined && value < data.min) {
            value = data.min;
            input.value = value;
          }
          if (data.max !== undefined && value > data.max) {
            value = data.max;
            input.value = value;
          }
        } else if (input.tagName === 'SELECT') {
          value = input.value;
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) value = numValue;
        } else {
          value = input.value;
        }

        vscode.postMessage({
          type: 'updateValue',
          file: data.file,
          key: data.key,
          value: value,
          valueType: data.type
        });

        const block = input.closest('.config-block');
        if (block) {
          block.classList.remove('updated');
          void block.offsetWidth;
          block.classList.add('updated');
        }
      }

      function updateTableCell(blockId, rowIndex, colKey, value) {
        const data = blockData[blockId];
        if (!data) return;

        vscode.postMessage({
          type: 'updateTableCell',
          file: data.file,
          key: data.key,
          rowIndex: rowIndex,
          colKey: colKey,
          value: value
        });

        // Flash the config block
        const container = document.getElementById(blockId + '-tabulator');
        if (container) {
          const block = container.closest('.config-block');
          if (block) {
            block.classList.remove('updated');
            void block.offsetWidth;
            block.classList.add('updated');
          }
        }
      }

      /** Initialize all Tabulator table instances */
      /** Initialize a deferred heavy block received via postMessage */
      function initDeferredBlock(msg) {
        if (msg.blockType === 'table') {
          initDeferredTable(msg);
        } else if (msg.blockType === 'code') {
          initDeferredCodeEditor(msg);
        }
      }

      /** Initialize a deferred Tabulator table */
      function initDeferredTable(msg) {
        if (typeof TabulatorGrid === 'undefined') { return; }
        var containerId = msg.blockId + '-tabulator';
        var container = document.getElementById(containerId);
        if (!container) { return; }

        // Remove skeleton
        var skeleton = document.getElementById(msg.blockId + '-skeleton');
        if (skeleton) { skeleton.remove(); }
        container.classList.remove('deferred-loading');

        try {
          var rowLocations = msg.rowLocations || [];
          TabulatorGrid.create(containerId, msg.columns, msg.rows, {
            onCellEdited: function(rowIndex, colKey, value) {
              updateTableCell(msg.blockId, rowIndex, colKey, value);
            },
            onGotoSource: function(rowIndex) {
              var loc = rowLocations[rowIndex];
              if (loc && loc.file && loc.line) {
                vscode.postMessage({
                  type: 'gotoSource',
                  file: loc.file,
                  line: loc.line
                });
              }
            }
          });
          // Fade-in animation
          container.classList.add('block-loaded');
        } catch (e) {
          console.error('Deferred Tabulator init error for ' + containerId, e);
          container.innerHTML = '<div style="color:var(--vscode-errorForeground);padding:8px;">Table load failed: ' + e.message + '</div>';
        }
      }

      /** Initialize a deferred CodeMirror editor */
      function initDeferredCodeEditor(msg) {
        if (typeof CodeEditor === 'undefined') { return; }
        var container = document.getElementById(msg.blockId + '-cm');
        if (!container) { return; }

        // Remove skeleton
        var skeleton = document.getElementById(msg.blockId + '-cm-skeleton');
        if (skeleton) { skeleton.remove(); }
        container.classList.remove('deferred-loading');

        // Update blockData with the received code info
        if (blockData[msg.blockId]) {
          blockData[msg.blockId].originalCode = msg.originalCode;
          blockData[msg.blockId].baseIndent = msg.baseIndent;
          blockData[msg.blockId].lang = msg.lang;
        }

        try {
          var data = blockData[msg.blockId];
          CodeEditor.create(
            msg.blockId,
            container,
            msg.originalCode,
            msg.lang || 'lua',
            function(code) {
              var modified = code !== (data ? data.originalCode : msg.originalCode);
              var hint = document.getElementById(msg.blockId + '-modified');
              if (hint) { hint.style.display = modified ? 'flex' : 'none'; }
            },
            function() {
              saveCode(msg.blockId);
            }
          );
          // Fade-in animation
          container.classList.add('block-loaded');
        } catch (e) {
          console.error('Deferred CodeEditor init error for ' + msg.blockId, e);
          container.innerHTML = '<div style="color:var(--vscode-errorForeground);padding:8px;">Code editor load failed: ' + e.message + '</div>';
        }
      }

      function adjustNumber(blockId, delta) {
        const input = document.getElementById(blockId);
        const data = blockData[blockId];
        if (!input || !data) return;

        const step = data.step || 1;
        let value = parseFloat(input.value) + (delta * step);

        if (data.min !== undefined && value < data.min) value = data.min;
        if (data.max !== undefined && value > data.max) value = data.max;

        input.value = value;
        updateValue(blockId);
      }

      function updateSliderDisplay(blockId) {
        const input = document.getElementById(blockId);
        const display = document.getElementById(blockId + '-display');
        if (input && display) {
          display.textContent = input.value;
        }
      }

      function handleKeyPress(event, blockId) {
        if (event.key === 'Enter') {
          updateValue(blockId);
        }
      }

      /* ========== 代码编辑器 (CodeMirror 6) ========== */

      /** 重置代码到原始内容 */
      function resetCode(blockId) {
        const data = blockData[blockId];
        if (!data || typeof CodeEditor === 'undefined') return;

        CodeEditor.setValue(blockId, data.originalCode);

        // 隐藏修改提示
        const hint = document.getElementById(blockId + '-modified');
        if (hint) hint.style.display = 'none';
      }

      /** 保存代码（还原缩进后发送） */
      function saveCode(blockId) {
        const data = blockData[blockId];
        if (!data || typeof CodeEditor === 'undefined') return;

        const code = CodeEditor.getValue(blockId);

        vscode.postMessage({
          type: 'saveCode',
          file: data.file,
          key: data.key,
          code: code,
          baseIndent: data.baseIndent || ''
        });

        // 保存后更新 originalCode 基线
        data.originalCode = code;
        const hint = document.getElementById(blockId + '-modified');
        if (hint) hint.style.display = 'none';

        // 闪烁动画
        const cmContainer = document.getElementById(blockId + '-cm');
        if (cmContainer) {
          const block = cmContainer.closest('.config-block');
          if (block) {
            block.classList.remove('updated');
            void block.offsetWidth;
            block.classList.add('updated');
          }
        }
      }

      // 初始化 Mermaid 图表渲染 (lightweight, keep synchronous)
      if (typeof MermaidRenderer !== 'undefined') {
        MermaidRenderer.renderAll();
      }

      // Heavy blocks (tables, code editors) are initialized asynchronously
      // via initBlock messages from the extension host

      /* ========== Copy & Send to AI Context ========== */

      /** Copy text to clipboard via extension (reliable in webview) */
      function copyContext(text) {
        if (!text) return;
        vscode.postMessage({ type: 'copyToClipboard', text: text });
      }

      /** Build @file reference string (workspace-relative path with optional line range) */
      function buildFileReference(blockId) {
        var data = blockData[blockId];
        if (!data) return '';
        var filePath = data.workspaceRelativePath || data.file || '';
        var startLine = data.startLine || 0;
        var endLine = data.endLine || 0;
        if (startLine && endLine && endLine !== startLine) {
          return '@' + filePath + ':' + startLine + '-' + endLine;
        } else if (startLine) {
          return '@' + filePath + ':' + startLine;
        }
        return '@' + filePath;
      }

      /** Copy file reference as @file format (backup for Add to Chat) */
      function copyCodeAsContext(blockId) {
        var ref = buildFileReference(blockId);
        if (ref) {
          vscode.postMessage({ type: 'copyToClipboard', text: ref });
        }
      }

      /** Add source file to Cursor AI chat as @file reference (like native drag-and-drop) */
      function addFileToChat(blockId) {
        var data = blockData[blockId];
        if (!data) return;
        var filePath = data.absoluteFilePath || '';
        if (!filePath) return;
        vscode.postMessage({
          type: 'addFileToChat',
          absoluteFilePath: filePath,
          workspaceRelativePath: data.workspaceRelativePath || ''
        });
      }


      /** Show a toast notification with paste hint */
      function showCopyToast(message) {
        // Remove any existing toast
        var old = document.querySelector('.copy-toast');
        if (old) old.remove();

        var toast = document.createElement('div');
        toast.className = 'copy-toast';

        var main = document.createElement('span');
        main.textContent = '✅ ' + message;
        toast.appendChild(main);

        var hint = document.createElement('span');
        hint.className = 'toast-hint';
        hint.innerHTML = '<kbd>Ctrl</kbd>+<kbd>V</kbd> 粘贴到聊天框';
        toast.appendChild(hint);

        document.body.appendChild(toast);
        requestAnimationFrame(function() { toast.classList.add('show'); });
        setTimeout(function() {
          toast.classList.remove('show');
          setTimeout(function() { toast.remove(); }, 300);
        }, 2500);
      }

      /** Listen for messages from extension */
      window.addEventListener('message', function(event) {
        var msg = event.data;
        if (msg && msg.type === 'clipboardDone') {
          showCopyToast('已复制');
        }
        if (msg && msg.type === 'scrollToSection') {
          scrollToSection(msg.sectionId);
        }
        if (msg && msg.type === 'wizardResult') {
          wizardShowResult(msg.wizardId, msg.success, msg.message || '');
        }
        if (msg && msg.type === 'initBlock') {
          initDeferredBlock(msg);
        }
      });

      /** Scroll to a section by its id and highlight it */
      function scrollToSection(sectionId) {
        if (!sectionId) return;
        var el = document.getElementById(sectionId);
        if (!el) {
          // Try fuzzy: match partial slug
          var all = document.querySelectorAll('[id]');
          for (var i = 0; i < all.length; i++) {
            if (all[i].id.indexOf(sectionId) !== -1) {
              el = all[i];
              break;
            }
          }
        }
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Highlight animation
        el.classList.add('scroll-highlight');
        setTimeout(function() { el.classList.remove('scroll-highlight'); }, 2000);
      }

      function gotoSource(file, line) {
        vscode.postMessage({
          type: 'gotoSource',
          file: file,
          line: line
        });
      }

      function gotoProbe(file, line) {
        vscode.postMessage({
          type: 'gotoProbe',
          file: file,
          line: line
        });
      }
      // Expose gotoProbe globally for Mermaid probe click callbacks
      window.gotoProbe = gotoProbe;

      function refresh() {
        vscode.postMessage({ type: 'refresh' });
      }

      /* ========== Wizard Functions ========== */

      /** Navigate to next wizard step */
      function wizardNextStep(wizardId, currentStep) {
        var nextStep = currentStep + 1;
        var currentEl = document.getElementById(wizardId + '-step-' + currentStep);
        var nextEl = document.getElementById(wizardId + '-step-' + nextStep);
        if (currentEl) currentEl.style.display = 'none';
        if (nextEl) nextEl.style.display = 'block';
        wizardUpdateProgress(wizardId, nextStep);
      }

      /** Navigate to previous wizard step */
      function wizardPrevStep(wizardId, currentStep) {
        var prevStep = currentStep - 1;
        var currentEl = document.getElementById(wizardId + '-step-' + currentStep);
        var prevEl = document.getElementById(wizardId + '-step-' + prevStep);
        if (currentEl) currentEl.style.display = 'none';
        if (prevEl) prevEl.style.display = 'block';
        wizardUpdateProgress(wizardId, prevStep);
      }

      /** Update progress dots */
      function wizardUpdateProgress(wizardId, activeStep) {
        var container = document.getElementById(wizardId + '-progress');
        if (!container) return;
        var dots = container.querySelectorAll('.wizard-progress-dot');
        var lines = container.querySelectorAll('.wizard-progress-line');
        dots.forEach(function(dot, i) {
          dot.classList.remove('active', 'done');
          if (i < activeStep) dot.classList.add('done');
          else if (i === activeStep) dot.classList.add('active');
        });
        lines.forEach(function(line, i) {
          line.classList.remove('done');
          if (i < activeStep) line.classList.add('done');
        });
      }

      /** Collect all wizard field values */
      function wizardCollectValues(wizardId) {
        var wizardEl = document.getElementById(wizardId);
        if (!wizardEl) return {};
        var data = {};
        try { data = JSON.parse(wizardEl.getAttribute('data-wizard') || '{}'); } catch(e) {}
        var steps = data.steps || [];
        var values = {};
        steps.forEach(function(step, i) {
          var input = document.getElementById(wizardId + '-input-' + i);
          if (!input) return;
          if (step.type === 'boolean') {
            values[step.field] = input.checked;
          } else if (step.type === 'number') {
            values[step.field] = parseFloat(input.value) || 0;
          } else {
            values[step.field] = input.value;
          }
        });
        return values;
      }

      /** Replace {{field}} placeholders in a template string with values */
      function wizardApplyTemplate(template, values) {
        var result = template;
        Object.keys(values).forEach(function(key) {
          var val = values[key];
          if (typeof val === 'boolean') val = val ? 'true' : 'false';
          result = result.split('{{' + key + '}}').join(String(val));
        });
        return result;
      }

      /** Generate code/commands from template */
      function wizardGenerateCode(wizardId) {
        var wizardEl = document.getElementById(wizardId);
        if (!wizardEl) return '';
        var data = {};
        try { data = JSON.parse(wizardEl.getAttribute('data-wizard') || '{}'); } catch(e) {}

        var values = wizardCollectValues(wizardId);
        // Also include resolved variables for placeholder replacement
        var resolvedVars = data.resolvedVars || {};
        var allValues = Object.assign({}, resolvedVars, values);

        // Choose the right template based on action
        var template = data.action === 'run' ? (data.commands || '') : (data.template || '');
        return wizardApplyTemplate(template, allValues);
      }

      /** Execute wizard: show preview */
      function wizardExecute(wizardId) {
        var code = wizardGenerateCode(wizardId);
        var previewEl = document.getElementById(wizardId + '-preview');
        var previewCode = document.getElementById(wizardId + '-preview-code');
        if (!previewEl || !previewCode) return;

        previewCode.textContent = code;
        // Hide all steps
        var wizardEl = document.getElementById(wizardId);
        if (!wizardEl) return;
        var data = {};
        try { data = JSON.parse(wizardEl.getAttribute('data-wizard') || '{}'); } catch(e) {}
        var steps = data.steps || [];
        steps.forEach(function(_, i) {
          var stepEl = document.getElementById(wizardId + '-step-' + i);
          if (stepEl) stepEl.style.display = 'none';
        });
        previewEl.style.display = 'block';
      }

      /** Hide preview and go back to last step */
      function wizardHidePreview(wizardId) {
        var previewEl = document.getElementById(wizardId + '-preview');
        if (previewEl) previewEl.style.display = 'none';
        var wizardEl = document.getElementById(wizardId);
        if (!wizardEl) return;
        var data = {};
        try { data = JSON.parse(wizardEl.getAttribute('data-wizard') || '{}'); } catch(e) {}
        var steps = data.steps || [];
        var lastIdx = steps.length - 1;
        var lastEl = document.getElementById(wizardId + '-step-' + lastIdx);
        if (lastEl) lastEl.style.display = 'block';
        wizardUpdateProgress(wizardId, lastIdx);
      }

      /** Confirm and execute wizard — post message to extension */
      function wizardConfirm(wizardId) {
        var wizardEl = document.getElementById(wizardId);
        if (!wizardEl) return;
        var data = {};
        try { data = JSON.parse(wizardEl.getAttribute('data-wizard') || '{}'); } catch(e) {}
        var generated = wizardGenerateCode(wizardId);

        var msg = {
          type: 'executeWizard',
          file: data.file || '',
          target: data.target || '',
          action: data.action || 'append',
          generatedCode: generated,
          wizardId: wizardId
        };

        // For 'run' action, also pass the resolved commands and cwd
        if (data.action === 'run') {
          msg.commands = generated;
          msg.cwd = data.cwd || '.';
        }

        vscode.postMessage(msg);

        // Show executing state
        wizardShowExecuting(wizardId);
      }

      /** Show executing/loading state in the wizard */
      function wizardShowExecuting(wizardId) {
        var wizardEl = document.getElementById(wizardId);
        if (!wizardEl) return;
        // Hide preview
        var previewEl = document.getElementById(wizardId + '-preview');
        if (previewEl) previewEl.style.display = 'none';
        // Show or create result area
        var resultEl = document.getElementById(wizardId + '-result');
        if (!resultEl) {
          resultEl = document.createElement('div');
          resultEl.id = wizardId + '-result';
          resultEl.className = 'wizard-result';
          var body = wizardEl.querySelector('.wizard-body');
          if (body) body.appendChild(resultEl);
        }
        resultEl.className = 'wizard-result wizard-result-executing';
        resultEl.innerHTML = '<div class="wizard-result-icon">⏳</div>'
          + '<div class="wizard-result-title">Executing...</div>'
          + '<div class="wizard-result-detail">Please wait while commands are being processed.</div>';
        resultEl.style.display = 'block';
        // Mark all progress dots as done
        var data = {};
        try { data = JSON.parse(wizardEl.getAttribute('data-wizard') || '{}'); } catch(e) {}
        var steps = data.steps || [];
        steps.forEach(function(_, i) {
          var dot = document.getElementById(wizardId + '-dot-' + i);
          if (dot) { dot.classList.remove('active'); dot.classList.add('done'); }
        });
        var lines = wizardEl.querySelectorAll('.wizard-progress-line');
        lines.forEach(function(line) { line.classList.add('done'); });
      }

      /** Show wizard execution result */
      function wizardShowResult(wizardId, success, message) {
        var wizardEl = document.getElementById(wizardId);
        if (!wizardEl) return;
        var resultEl = document.getElementById(wizardId + '-result');
        if (!resultEl) {
          resultEl = document.createElement('div');
          resultEl.id = wizardId + '-result';
          resultEl.className = 'wizard-result';
          var body = wizardEl.querySelector('.wizard-body');
          if (body) body.appendChild(resultEl);
        }

        if (success) {
          resultEl.className = 'wizard-result wizard-result-success';
          resultEl.innerHTML = '<div class="wizard-result-icon">✅</div>'
            + '<div class="wizard-result-title">Completed Successfully</div>'
            + (message ? '<div class="wizard-result-detail">' + message + '</div>' : '')
            + '<div class="wizard-result-actions">'
            + '<button class="wizard-btn wizard-btn-secondary" onclick="wizardRestart(' + JSON.stringify(wizardId) + ')">🔄 Restart Wizard</button>'
            + '</div>';
        } else {
          resultEl.className = 'wizard-result wizard-result-error';
          resultEl.innerHTML = '<div class="wizard-result-icon">❌</div>'
            + '<div class="wizard-result-title">Execution Failed</div>'
            + (message ? '<div class="wizard-result-detail">' + message + '</div>' : '')
            + '<div class="wizard-result-actions">'
            + '<button class="wizard-btn wizard-btn-primary" onclick="wizardRestart(' + JSON.stringify(wizardId) + ')">🔄 Restart Wizard</button>'
            + '</div>';
        }
        resultEl.style.display = 'block';
      }

      /** Restart wizard — reset to initial state */
      function wizardRestart(wizardId) {
        var wizardEl = document.getElementById(wizardId);
        if (!wizardEl) return;
        // Hide result area
        var resultEl = document.getElementById(wizardId + '-result');
        if (resultEl) resultEl.style.display = 'none';
        // Hide preview
        var previewEl = document.getElementById(wizardId + '-preview');
        if (previewEl) previewEl.style.display = 'none';
        // Show first step
        var data = {};
        try { data = JSON.parse(wizardEl.getAttribute('data-wizard') || '{}'); } catch(e) {}
        var steps = data.steps || [];
        steps.forEach(function(_, i) {
          var stepEl = document.getElementById(wizardId + '-step-' + i);
          if (stepEl) stepEl.style.display = i === 0 ? 'block' : 'none';
        });
        // Reset progress
        wizardUpdateProgress(wizardId, 0);
      }
    `;
  }
}
