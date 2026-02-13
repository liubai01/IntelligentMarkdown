/**
 * 智能 Markdown 编辑器
 * 基于 Webview 的可视化配置预览编辑器
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigBlockParser } from '../core/parser/configBlockParser';
import { LuaLinker, LinkedConfigBlock } from '../core/linker/luaLinker';
import { LuaParser } from '../core/parser/luaParser';
import { LuaPatcher } from '../core/patcher/luaPatcher';
import { PathResolver } from '../core/linker/pathResolver';

export class SmartMarkdownEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'intelligentMarkdown.preview';

  private configParser: ConfigBlockParser;
  private luaLinker: LuaLinker;
  private pathResolver: PathResolver;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.configParser = new ConfigBlockParser();
    this.luaLinker = new LuaLinker();
    this.pathResolver = new PathResolver();
  }

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // 配置 Webview
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };

    // 初始渲染
    await this.updateWebview(document, webviewPanel.webview);

    // 监听 Webview 消息
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
          case 'gotoSource':
            await this.handleGotoSource(message);
            break;
          case 'refresh':
            await this.updateWebview(document, webviewPanel.webview);
            break;
        }
      },
      undefined,
      this.context.subscriptions
    );

    // 监听文档变化
    const changeSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        this.updateWebview(document, webviewPanel.webview);
      }
    });

    // 监听 Lua 文件变化
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
   * 更新 Webview 内容
   */
  private async updateWebview(
    document: vscode.TextDocument,
    webview: vscode.Webview
  ): Promise<void> {
    const text = document.getText();
    const blocks = this.configParser.parseMarkdown(text);
    const linkedBlocks = await this.luaLinker.linkBlocks(blocks, document.uri.fsPath);

    webview.html = this.getHtmlContent(webview, text, linkedBlocks);
  }

  /**
   * 处理值更新
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

      // 读取 Lua 文件
      const luaCode = fs.readFileSync(luaPath, 'utf-8');

      // 解析并定位
      const parser = new LuaParser(luaCode);
      const result = parser.findNodeByPath(message.key);

      if (!result.success || !result.node) {
        vscode.window.showErrorMessage(`找不到变量: ${message.key}`);
        return;
      }

      // 生成新代码
      const patcher = new LuaPatcher(luaCode);
      const newCode = patcher.updateValue(result.node, message.value);

      // 写入文件
      fs.writeFileSync(luaPath, newCode, 'utf-8');

      // 清除缓存
      this.luaLinker.clearCache(luaPath);

      vscode.window.showInformationMessage(`已更新 ${message.key} = ${message.value}`);
    } catch (error) {
      vscode.window.showErrorMessage(
        `更新失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 处理表格单元格更新
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

      // 读取 Lua 文件
      const luaCode = fs.readFileSync(luaPath, 'utf-8');

      // 解析并定位表格数组
      const parser = new LuaParser(luaCode);
      const result = parser.findNodeByPath(message.key);

      if (!result.success || !result.astNode) {
        vscode.window.showErrorMessage(`找不到变量: ${message.key}`);
        return;
      }

      // 提取表格数组
      const tableData = parser.extractTableArray(result.astNode);
      
      if (!tableData || message.rowIndex >= tableData.length) {
        vscode.window.showErrorMessage(`无效的行索引: ${message.rowIndex}`);
        return;
      }

      // 获取目标单元格的范围
      const cellRange = tableData[message.rowIndex].ranges[message.colKey];
      
      if (!cellRange) {
        vscode.window.showErrorMessage(`找不到字段: ${message.colKey}`);
        return;
      }

      // 确定值类型
      let valueType: 'number' | 'string' | 'boolean' = 'string';
      if (typeof message.value === 'number') {
        valueType = 'number';
      } else if (typeof message.value === 'boolean') {
        valueType = 'boolean';
      }

      // 生成新代码
      const patcher = new LuaPatcher(luaCode);
      const newCode = patcher.updateValueByRange(cellRange, message.value, valueType);

      // 写入文件
      fs.writeFileSync(luaPath, newCode, 'utf-8');

      // 清除缓存
      this.luaLinker.clearCache(luaPath);

      vscode.window.showInformationMessage(
        `已更新表格 [${message.rowIndex}].${message.colKey} = ${message.value}`
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `更新表格失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 跳转到源码
   */
  private async handleGotoSource(message: { file: string; line: number }): Promise<void> {
    try {
      const uri = vscode.Uri.file(message.file);
      const document = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);

      const position = new vscode.Position(message.line - 1, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
    } catch (error) {
      vscode.window.showErrorMessage(`无法打开文件`);
    }
  }

  /**
   * 生成 HTML 内容
   */
  private getHtmlContent(
    webview: vscode.Webview,
    markdownText: string,
    linkedBlocks: LinkedConfigBlock[]
  ): string {
    // 将 markdown 转换为 HTML，并替换配置块为控件
    const htmlContent = this.renderMarkdownWithControls(markdownText, linkedBlocks);

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'unsafe-inline';">
  <title>配置预览</title>
  <style>
    ${this.getStyles()}
  </style>
</head>
<body>
  <div class="container">
    <div class="toolbar">
      <button onclick="refresh()" title="刷新">🔄 刷新</button>
    </div>
    <div class="content">
      ${htmlContent}
    </div>
  </div>
  <script>
    ${this.getScript(linkedBlocks)}
  </script>
</body>
</html>`;
  }

  /**
   * 渲染 Markdown 并替换配置块为控件
   */
  private renderMarkdownWithControls(
    markdownText: string,
    linkedBlocks: LinkedConfigBlock[]
  ): string {
    let html = markdownText;

    // 第一步：用占位符替换配置块，避免 Markdown 转换影响 HTML
    const placeholders: Map<string, string> = new Map();
    for (let i = 0; i < linkedBlocks.length; i++) {
      const block = linkedBlocks[i];
      const placeholder = `__CONFIG_BLOCK_PLACEHOLDER_${i}__`;
      const controlHtml = this.renderConfigControl(block);
      placeholders.set(placeholder, controlHtml);
      html = html.replace(block.rawText, placeholder);
    }

    // 第二步：Markdown 转换
    html = this.simpleMarkdownToHtml(html);

    // 第三步：将占位符替换回实际的 HTML 控件
    for (const [placeholder, controlHtml] of placeholders) {
      html = html.replace(placeholder, controlHtml);
    }

    return html;
  }

  /**
   * 渲染配置控件
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
        default:
          inputHtml = this.renderNumberInput(block, blockId);
      }
    } else {
      inputHtml = `<span class="error-message">${block.linkError}</span>`;
    }

    return `
<div class="config-block ${statusClass}" data-block-id="${blockId}">
  <div class="config-header">
    <span class="status-icon">${statusIcon}</span>
    <span class="config-label">${label}</span>
    <span class="config-key" title="${block.key}">${block.key}</span>
    ${block.linkStatus === 'ok' ? `<button class="goto-btn" onclick="gotoSource('${block.absoluteFilePath.replace(/\\/g, '\\\\')}', ${block.luaNode?.loc.start.line || 1})" title="跳转到源码">📍</button>` : ''}
  </div>
  <div class="config-input">
    ${inputHtml}
  </div>
  ${block.unit ? `<span class="config-unit">${block.unit}</span>` : ''}
</div>`;
  }

  /**
   * 渲染数字输入框
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
${block.min !== undefined && block.max !== undefined ? `<span class="range-hint">范围: ${block.min} ~ ${block.max}</span>` : ''}`;
  }

  /**
   * 渲染滑动条
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
   * 渲染布尔开关
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
  <span class="switch-label">${block.currentValue ? '开启' : '关闭'}</span>
</label>`;
  }

  /**
   * 渲染字符串输入框
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
   * 渲染下拉选择
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
   * 渲染表格输入
   */
  private renderTableInput(block: LinkedConfigBlock, blockId: string): string {
    if (!block.columns || block.columns.length === 0) {
      return `<span class="error-message">表格类型需要定义 columns</span>`;
    }

    // 使用已经链接好的表格数据
    const tableData = block.luaNode?.tableData;
    
    if (!tableData || tableData.length === 0) {
      return `<div class="table-empty">暂无数据</div>`;
    }

    // 生成表头
    const headerCells = block.columns.map(col => 
      `<th style="${col.width ? `width: ${col.width};` : ''}">${col.label}</th>`
    ).join('');

    // 生成表格行
    const rows = tableData.map((row, rowIndex) => {
      const cells = block.columns!.map(col => {
        const cellId = `${blockId}-${rowIndex}-${col.key}`;
        const cellValue = row.data[col.key] ?? '';
        let cellInput = '';

        switch (col.type) {
          case 'number':
            const min = col.min !== undefined ? `min="${col.min}"` : '';
            const max = col.max !== undefined ? `max="${col.max}"` : '';
            const step = col.step !== undefined ? `step="${col.step}"` : 'step="1"';
            cellInput = `<input type="number" class="table-cell-input" id="${cellId}" value="${cellValue}" ${min} ${max} ${step} ${col.readonly ? 'readonly' : ''} onchange="updateTableCell('${blockId}', ${rowIndex}, '${col.key}')">`;
            break;
          case 'string':
            cellInput = `<input type="text" class="table-cell-input" id="${cellId}" value="${this.escapeHtml(String(cellValue))}" ${col.readonly ? 'readonly' : ''} onchange="updateTableCell('${blockId}', ${rowIndex}, '${col.key}')">`;
            break;
          case 'boolean':
            cellInput = `<input type="checkbox" class="table-cell-checkbox" id="${cellId}" ${cellValue ? 'checked' : ''} ${col.readonly ? 'disabled' : ''} onchange="updateTableCell('${blockId}', ${rowIndex}, '${col.key}')">`;
            break;
          case 'select':
            const opts = (col.options || []).map(opt => {
              const selected = opt.value === cellValue || String(opt.value) === String(cellValue) ? 'selected' : '';
              return `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
            }).join('');
            cellInput = `<select class="table-cell-select" id="${cellId}" ${col.readonly ? 'disabled' : ''} onchange="updateTableCell('${blockId}', ${rowIndex}, '${col.key}')">${opts}</select>`;
            break;
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
   * 简单的 Markdown 转 HTML
   * 更紧凑的排版，避免过多空行
   */
  private simpleMarkdownToHtml(text: string): string {
    // 将文本按行分割处理
    const lines = text.split('\n');
    const result: string[] = [];
    let inBlockquote = false;
    let blockquoteLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 跳过占位符周围的空行
      if (line.trim() === '' && 
          (result.length > 0 && result[result.length - 1].includes('__CONFIG_BLOCK_PLACEHOLDER_'))) {
        continue;
      }
      if (line.trim() === '' && 
          i + 1 < lines.length && lines[i + 1].includes('__CONFIG_BLOCK_PLACEHOLDER_')) {
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
      if (line.includes('__CONFIG_BLOCK_PLACEHOLDER_')) {
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
            !lastLine.includes('__CONFIG_BLOCK_PLACEHOLDER_')) {
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
   * 处理行内 Markdown 语法
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
   * 生成块 ID
   */
  private generateBlockId(block: LinkedConfigBlock): string {
    return `block-${block.key.replace(/\./g, '-').replace(/\[|\]/g, '_')}`;
  }

  /**
   * 格式化值
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
   * HTML 转义
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
   * 获取样式 - 基于 GitHub Markdown 风格
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

      /* ========== 更新动画 ========== */
      @keyframes flash {
        0% { background-color: rgba(26, 127, 55, 0.15); }
        100% { background-color: var(--color-canvas-subtle); }
      }

      .config-block.updated {
        animation: flash 0.6s ease-out;
      }
    `;
  }

  /**
   * 获取脚本
   */
  private getScript(linkedBlocks: LinkedConfigBlock[]): string {
    // 创建块数据映射
    const blockDataMap: Record<string, any> = {};
    for (const block of linkedBlocks) {
      const blockId = this.generateBlockId(block);
      blockDataMap[blockId] = {
        file: block.file,
        key: block.key,
        type: block.type,
        min: block.min,
        max: block.max,
        step: block.step || 1
      };
    }

    return `
      const vscode = acquireVsCodeApi();
      const blockData = ${JSON.stringify(blockDataMap)};

      function updateValue(blockId) {
        const input = document.getElementById(blockId);
        const data = blockData[blockId];
        if (!input || !data) return;

        let value;
        if (input.type === 'checkbox') {
          value = input.checked;
          // 更新标签
          const label = input.closest('.switch').querySelector('.switch-label');
          if (label) label.textContent = value ? '开启' : '关闭';
        } else if (input.type === 'number' || input.type === 'range') {
          value = parseFloat(input.value);
          if (isNaN(value)) return;
          // 验证范围
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
          // 尝试转为数字
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) value = numValue;
        } else {
          value = input.value;
        }

        // 发送更新消息
        vscode.postMessage({
          type: 'updateValue',
          file: data.file,
          key: data.key,
          value: value,
          valueType: data.type
        });

        // 添加更新动画
        const block = input.closest('.config-block');
        if (block) {
          block.classList.remove('updated');
          void block.offsetWidth; // 触发重绘
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

        // 发送表格单元格更新消息
        vscode.postMessage({
          type: 'updateTableCell',
          file: data.file,
          key: data.key,
          rowIndex: rowIndex,
          colKey: colKey,
          value: value
        });

        // 添加更新动画
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

        // 限制范围
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

      function gotoSource(file, line) {
        vscode.postMessage({
          type: 'gotoSource',
          file: file,
          line: line
        });
      }

      function refresh() {
        vscode.postMessage({ type: 'refresh' });
      }
    `;
  }
}
