/**
 * Smart Markdown Editor
 * Visual config preview editor based on Webview
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigBlockParser } from '../core/parser/configBlockParser';
import { LuaLinker, LinkedConfigBlock } from '../core/linker/luaLinker';
import { LuaParser } from '../core/parser/luaParser';
import { LuaPatcher } from '../core/patcher/luaPatcher';
import { PathResolver } from '../core/linker/pathResolver';
import { ProbeScanner } from '../core/probeScanner';

export class SmartMarkdownEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'intelligentMarkdown.preview';

  private configParser: ConfigBlockParser;
  private luaLinker: LuaLinker;
  private pathResolver: PathResolver;
  private probeScanner: ProbeScanner;
  /** Code block indent normalization cache (rebuilt on each render) */
  private codeNormCache: Map<string, { normalized: string; baseIndent: string }> = new Map();

  constructor(private readonly context: vscode.ExtensionContext) {
    this.configParser = new ConfigBlockParser();
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

    // Listen to Lua file changes
    const luaWatcher = vscode.workspace.createFileSystemWatcher('**/*.lua');
    luaWatcher.onDidChange(() => {
      this.luaLinker.clearCache();
      this.updateWebview(document, webviewPanel.webview);
    });

    webviewPanel.onDidDispose(() => {
      changeSubscription.dispose();
      luaWatcher.dispose();
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

    webview.html = this.getHtmlContent(webview, text, linkedBlocks, document.uri.fsPath);
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
      const luaPath = this.pathResolver.resolve(mdDir, message.file);

      if (!fs.existsSync(luaPath)) {
        vscode.window.showErrorMessage(`文件不存在: ${luaPath}`);
        return;
      }

      // Read Lua file
      const luaCode = fs.readFileSync(luaPath, 'utf-8');

      // Parse and locate
      const parser = new LuaParser(luaCode);
      const result = parser.findNodeByPath(message.key);

      if (!result.success || !result.node) {
        vscode.window.showErrorMessage(vscode.l10n.t('Variable not found: {0}', message.key));
        return;
      }

      // Generate new code
      const patcher = new LuaPatcher(luaCode);
      const newCode = patcher.updateValue(result.node, message.value);

      // Write file
      fs.writeFileSync(luaPath, newCode, 'utf-8');

      // Clear cache
      this.luaLinker.clearCache(luaPath);

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
    documentPath: string
  ): string {
    // Clear indent normalization cache
    this.codeNormCache.clear();

    // Convert markdown to HTML and replace config blocks with controls
    const htmlContent = this.renderMarkdownWithControls(markdownText, linkedBlocks, documentPath);

    // CodeMirror bundle URI
    const codeEditorScriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'codeEditor.js')
    );

    // Mermaid bundle URI
    const mermaidScriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'mermaid.js')
    );

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; img-src ${webview.cspSource} data:;">
  <title>${vscode.l10n.t('Config Preview')}</title>
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
  <script>
    ${this.getScript(linkedBlocks)}
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
    documentPath: string
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
        replacement = `<span class="probe-link-group"><a class="probe-link" href="javascript:void(0)" onclick="gotoProbe('${escapedPath}', ${target.line})" title="${vscode.l10n.t('Jump to probe "{0}" (Line {1})', probeLink.probeName, target.line)}">📍 ${this.escapeHtml(probeLink.displayText)}</a><button class="probe-copy-btn" onclick="copyContext('${this.escapeHtml(copyContext).replace(/'/g, '\\\'')}')" title="${vscode.l10n.t('Copy reference for AI context')}">📋</button></span>`;
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
    <button class="copy-handle" onclick="copyContext(this.closest('.config-block').getAttribute('data-copy-context'))" title="${vscode.l10n.t('Copy as AI context')}">📋</button>
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
   * Render table input
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

    // Generate table header
    const headerCells = block.columns.map(col => 
      `<th style="${col.width ? `width: ${col.width};` : ''}">${col.label}</th>`
    ).join('');

    // Generate table rows
    const rows = tableData.map((row, rowIndex) => {
      const cells = block.columns!.map(col => {
        const cellId = `${blockId}-${rowIndex}-${col.key}`;
        const cellValue = row.data[col.key] ?? '';
        let cellInput = '';

        switch (col.type) {
          case 'number': {
            const min = col.min !== undefined ? `min="${col.min}"` : '';
            const max = col.max !== undefined ? `max="${col.max}"` : '';
            const step = col.step !== undefined ? `step="${col.step}"` : 'step="1"';
            cellInput = `<input type="number" class="table-cell-input" id="${cellId}" value="${cellValue}" ${min} ${max} ${step} ${col.readonly ? 'readonly' : ''} onchange="updateTableCell('${blockId}', ${rowIndex}, '${col.key}')">`;
            break;
          }
          case 'string':
            cellInput = `<input type="text" class="table-cell-input" id="${cellId}" value="${this.escapeHtml(String(cellValue))}" ${col.readonly ? 'readonly' : ''} onchange="updateTableCell('${blockId}', ${rowIndex}, '${col.key}')">`;
            break;
          case 'boolean':
            cellInput = `<input type="checkbox" class="table-cell-checkbox" id="${cellId}" ${cellValue ? 'checked' : ''} ${col.readonly ? 'disabled' : ''} onchange="updateTableCell('${blockId}', ${rowIndex}, '${col.key}')">`;
            break;
          case 'select': {
            const opts = (col.options || []).map(opt => {
              const selected = opt.value === cellValue || String(opt.value) === String(cellValue) ? 'selected' : '';
              return `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
            }).join('');
            cellInput = `<select class="table-cell-select" id="${cellId}" ${col.readonly ? 'disabled' : ''} onchange="updateTableCell('${blockId}', ${rowIndex}, '${col.key}')">${opts}</select>`;
            break;
          }
        }

        return `<td>${cellInput}</td>`;
      }).join('');

      return `<tr>${cells}</tr>`;
    }).join('');

    return `
<div class="table-wrapper">
  <table class="config-table">
    <thead>
      <tr>${headerCells}</tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</div>`;
  }

  /**
   * Render code input (CodeMirror 6 editor)
   */
  private renderCodeInput(block: LinkedConfigBlock, blockId: string): string {
    const t = vscode.l10n.t;
    const functionSource = block.currentValue || '-- No function found';

    // Indent normalization
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
    <button class="code-btn code-copy-btn" onclick="copyCodeAsContext('${blockId}')" title="${t('Copy code as AI context')}">
      📋 ${t('Copy')}
    </button>
    ${block.linkStatus === 'ok' ? `<button class="code-btn code-goto-btn" onclick="gotoSource('${block.absoluteFilePath.replace(/\\/g, '\\\\')}', ${block.luaNode?.loc.start.line || 1})" title="${t('Jump to function in source file')}">📍 ${t('Go to Source')}</button>` : ''}
  </div>
  <div class="code-cm-container" id="${blockId}-cm"></div>
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

      // 标题
      if (line.startsWith('### ')) {
        result.push(`<h3>${this.processInlineMarkdown(line.slice(4))}</h3>`);
        continue;
      }
      if (line.startsWith('## ')) {
        result.push(`<h2>${this.processInlineMarkdown(line.slice(3))}</h2>`);
        continue;
      }
      if (line.startsWith('# ')) {
        result.push(`<h1>${this.processInlineMarkdown(line.slice(2))}</h1>`);
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

      /* ========== Copy-as-context buttons ========== */
      .copy-handle {
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 1px 3px;
        border-radius: 3px;
        opacity: 0.25;
        font-size: 11px;
        line-height: 1;
        transition: opacity 0.15s, background 0.15s;
      }

      .copy-handle:hover {
        opacity: 0.9;
        background: rgba(128, 128, 128, 0.15);
      }

      .probe-link-group {
        display: inline-flex;
        align-items: center;
        gap: 2px;
      }

      .probe-copy-btn {
        background: transparent;
        border: none;
        cursor: pointer;
        font-size: 10px;
        padding: 0 2px;
        opacity: 0;
        transition: opacity 0.15s;
        vertical-align: middle;
        line-height: 1;
      }

      .probe-link-group:hover .probe-copy-btn {
        opacity: 0.5;
      }

      .probe-copy-btn:hover {
        opacity: 1 !important;
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

      /* ========== 表格样式 ========== */
      .table-wrapper {
        width: 100%;
        overflow-x: auto;
        margin: 8px 0;
      }

      .config-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
        background: var(--color-canvas-default);
        border: 1px solid var(--color-border-muted);
        border-radius: 6px;
        overflow: hidden;
      }

      .config-table thead {
        background: var(--color-canvas-subtle);
      }

      .config-table th {
        padding: 8px 12px;
        text-align: left;
        font-weight: 600;
        color: var(--color-fg-default);
        border-bottom: 2px solid var(--color-border-default);
      }

      .config-table td {
        padding: 6px 12px;
        border-bottom: 1px solid var(--color-border-muted);
      }

      .config-table tbody tr:last-child td {
        border-bottom: none;
      }

      .config-table tbody tr:hover {
        background: var(--color-canvas-subtle);
      }

      .table-cell-input {
        width: 100%;
        padding: 4px 8px;
        border: 1px solid var(--input-border);
        border-radius: 4px;
        background: var(--input-bg);
        color: var(--input-fg);
        font-size: 12px;
        transition: border-color 0.15s;
      }

      .table-cell-input:focus {
        outline: none;
        border-color: var(--color-accent);
      }

      .table-cell-input[readonly] {
        background: rgba(128, 128, 128, 0.1);
        cursor: not-allowed;
      }

      .table-cell-checkbox {
        width: 16px;
        height: 16px;
        cursor: pointer;
      }

      .table-cell-checkbox:disabled {
        cursor: not-allowed;
        opacity: 0.5;
      }

      .table-cell-select {
        width: 100%;
        padding: 4px 8px;
        border: 1px solid var(--input-border);
        border-radius: 4px;
        background: var(--input-bg);
        color: var(--input-fg);
        font-size: 12px;
        cursor: pointer;
      }

      .table-cell-select:focus {
        outline: none;
        border-color: var(--color-accent);
      }

      .table-cell-select:disabled {
        cursor: not-allowed;
        opacity: 0.5;
      }

      .table-empty {
        padding: 24px;
        text-align: center;
        color: var(--color-fg-muted);
        font-size: 13px;
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

      /* ========== Copy toast ========== */
      .copy-toast {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%) translateY(10px);
        background: var(--color-fg-default);
        color: var(--color-canvas-default);
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 13px;
        opacity: 0;
        transition: opacity 0.3s, transform 0.3s;
        z-index: 9999;
        pointer-events: none;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }

      .copy-toast.show {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    `;
  }

  /**
   * Get script
   */
  private getScript(linkedBlocks: LinkedConfigBlock[]): string {
    // Create block data mapping (including code block normalization info)
    const blockDataMap: Record<string, any> = {};
    for (const block of linkedBlocks) {
      const blockId = this.generateBlockId(block);
      const normData = this.codeNormCache.get(blockId);
      blockDataMap[blockId] = {
        file: block.file,
        key: block.key,
        type: block.type,
        min: block.min,
        max: block.max,
        step: block.step || 1,
        lang: block.type === 'code' ? this.getLanguageFromFile(block.absoluteFilePath) : undefined,
        baseIndent: normData?.baseIndent || '',
        originalCode: normData?.normalized || ''
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

      function updateTableCell(blockId, rowIndex, colKey) {
        const cellId = blockId + '-' + rowIndex + '-' + colKey;
        const input = document.getElementById(cellId);
        const data = blockData[blockId];
        if (!input || !data) return;

        let value;
        if (input.type === 'checkbox') {
          value = input.checked;
        } else if (input.type === 'number') {
          value = parseFloat(input.value);
          if (isNaN(value)) return;
        } else if (input.tagName === 'SELECT') {
          value = input.value;
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) value = numValue;
        } else {
          value = input.value;
        }

        vscode.postMessage({
          type: 'updateTableCell',
          file: data.file,
          key: data.key,
          rowIndex: rowIndex,
          colKey: colKey,
          value: value
        });

        const block = input.closest('.config-block');
        if (block) {
          block.classList.remove('updated');
          void block.offsetWidth;
          block.classList.add('updated');
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

      /** 初始化所有 CodeMirror 编辑器 */
      function initCodeEditors() {
        if (typeof CodeEditor === 'undefined') return;

        Object.keys(blockData).forEach(function(blockId) {
          const data = blockData[blockId];
          if (data.type !== 'code') return;

          const container = document.getElementById(blockId + '-cm');
          if (!container) return;

          CodeEditor.create(
            blockId,
            container,
            data.originalCode,
            data.lang || 'lua',
            function(code) {
              // 修改检测回调
              const modified = code !== data.originalCode;
              const hint = document.getElementById(blockId + '-modified');
              if (hint) hint.style.display = modified ? 'flex' : 'none';
            },
            function() {
              // Ctrl+S / Cmd+S 保存回调
              saveCode(blockId);
            }
          );
        });
      }

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

      // 初始化 CodeMirror 编辑器
      initCodeEditors();

      // 初始化 Mermaid 图表渲染
      if (typeof MermaidRenderer !== 'undefined') {
        MermaidRenderer.renderAll();
      }

      /* ========== Copy-as-Context for AI ========== */

      /** Copy text to clipboard via extension (reliable in webview) */
      function copyContext(text) {
        if (!text) return;
        vscode.postMessage({ type: 'copyToClipboard', text: text });
      }

      /** Copy code block content as AI-friendly context */
      function copyCodeAsContext(blockId) {
        const data = blockData[blockId];
        if (!data) return;
        var code = '';
        if (typeof CodeEditor !== 'undefined') {
          code = CodeEditor.getValue(blockId);
        }
        if (!code) code = data.originalCode || '';
        var lang = data.lang || 'lua';
        var contextText = '// File: ' + data.file + ', Key: ' + data.key + '\\n' +
          '\`\`\`' + lang + '\\n' + code + '\\n\`\`\`';
        vscode.postMessage({ type: 'copyToClipboard', text: contextText });
      }

      /** Show a brief toast notification */
      function showCopyToast(message) {
        var toast = document.createElement('div');
        toast.className = 'copy-toast';
        toast.textContent = '✅ ' + message;
        document.body.appendChild(toast);
        requestAnimationFrame(function() { toast.classList.add('show'); });
        setTimeout(function() {
          toast.classList.remove('show');
          setTimeout(function() { toast.remove(); }, 300);
        }, 1500);
      }

      /** Listen for clipboard done confirmation from extension */
      window.addEventListener('message', function(event) {
        var msg = event.data;
        if (msg && msg.type === 'clipboardDone') {
          showCopyToast('Copied to clipboard');
        }
      });

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
    `;
  }
}
