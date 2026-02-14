/**
 * 智能 Markdown 编辑器
 * 基于 Webview 的可视化配置预览编辑器
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import hljs from 'highlight.js';
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
  /** 代码块缩进归一化缓存（每次渲染时重建） */
  private codeNormCache: Map<string, { normalized: string; baseIndent: string }> = new Map();

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
          case 'saveCode':
            await this.handleSaveCode(document, message);
            await this.updateWebview(document, webviewPanel.webview);
            break;
          case 'gotoSource':
            await this.handleGotoSource(message);
            break;
          case 'requestHighlight':
            this.handleHighlightRequest(webviewPanel.webview, message);
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
   * 处理语法高亮请求（来自 Webview）
   */
  private handleHighlightRequest(
    webview: vscode.Webview,
    message: { blockId: string; code: string; lang: string }
  ): void {
    try {
      const lang = message.lang || 'lua';
      let highlighted: string;
      try {
        highlighted = hljs.highlight(message.code, { language: lang, ignoreIllegals: true }).value;
      } catch {
        highlighted = hljs.highlightAuto(message.code).value;
      }
      webview.postMessage({
        type: 'highlightResult',
        blockId: message.blockId,
        html: highlighted
      });
    } catch {
      // 静默失败，保留上次高亮
    }
  }

  /**
   * 归一化缩进：提取非首行的公共缩进前缀并去除
   * 首行保持不变（通常是 function 关键字，没有前导缩进）
   */
  private normalizeIndentation(code: string): { normalized: string; baseIndent: string } {
    const lines = code.split('\n');
    if (lines.length <= 1) { return { normalized: code, baseIndent: '' }; }

    // 找到第 2 行及之后非空行的最小缩进
    let minIndent = Infinity;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') { continue; }
      const match = line.match(/^(\s+)/);
      const indent = match ? match[1].length : 0;
      minIndent = Math.min(minIndent, indent);
    }

    if (minIndent === 0 || minIndent === Infinity) { return { normalized: code, baseIndent: '' }; }

    // 提取 baseIndent 实际字符串（保留 tab/space 原样）
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
   * 还原缩进
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
   * 从文件路径获取语言标识
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
   * 生成 HTML 内容
   */
  private getHtmlContent(
    webview: vscode.Webview,
    markdownText: string,
    linkedBlocks: LinkedConfigBlock[]
  ): string {
    // 清除缩进归一化缓存
    this.codeNormCache.clear();

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
        case 'code':
          inputHtml = this.renderCodeInput(block, blockId);
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
   * 渲染代码编辑控件（overlay 高亮 + textarea 编辑 + 缩进归一化）
   */
  private renderCodeInput(block: LinkedConfigBlock, blockId: string): string {
    const functionSource = block.currentValue || '-- No function found';

    // 缩进归一化
    const { normalized, baseIndent } = this.normalizeIndentation(functionSource);
    this.codeNormCache.set(blockId, { normalized, baseIndent });

    const escapedSource = this.escapeHtml(normalized);
    const lineCount = normalized.split('\n').length;
    const rows = Math.max(6, Math.min(lineCount + 1, 30));

    // 语法高亮（服务端预渲染）
    const lang = this.getLanguageFromFile(block.absoluteFilePath);
    let highlightedHtml: string;
    try {
      highlightedHtml = hljs.highlight(normalized, { language: lang, ignoreIllegals: true }).value;
    } catch {
      highlightedHtml = this.escapeHtml(normalized);
    }

    return `
<div class="code-wrapper">
  <div class="code-modified-hint" id="${blockId}-modified" style="display:none;">
    ⚠️ 内容已修改，可以保存
  </div>
  <div class="code-toolbar">
    <button class="code-btn code-save-btn" onclick="saveCode('${blockId}')" title="保存修改到源文件">
      💾 保存
    </button>
    <button class="code-btn code-reset-btn" onclick="resetCode('${blockId}')" title="重置为原始代码">
      ↩️ 重置
    </button>
    ${block.linkStatus === 'ok' ? `<button class="code-btn code-goto-btn" onclick="gotoSource('${block.absoluteFilePath.replace(/\\/g, '\\\\')}', ${block.luaNode?.loc.start.line || 1})" title="跳转到源文件函数">📍 跳转源码</button>` : ''}
  </div>
  <div class="code-overlay-container" id="${blockId}-container">
    <pre class="code-highlight-pre" id="${blockId}-pre" aria-hidden="true"><code class="hljs" id="${blockId}-highlight">${highlightedHtml}</code></pre>
    <textarea
      id="${blockId}"
      class="code-overlay-textarea"
      rows="${rows}"
      spellcheck="false"
      onkeydown="handleCodeKeydown(event, '${blockId}')"
      oninput="onCodeInput('${blockId}')"
      onscroll="syncScroll('${blockId}')"
    >${escapedSource}</textarea>
  </div>
</div>`;
  }

  /**
   * 处理代码保存：从 webview 接收归一化后的代码，还原缩进后写回源文件
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

      // 重新解析源文件以获取函数的当前范围
      const luaCode = fs.readFileSync(luaPath, 'utf-8');
      const parser = new LuaParser(luaCode);
      const result = parser.findFunctionByFullPath(message.key);

      if (!result.success || !result.node) {
        vscode.window.showErrorMessage(`在源文件中找不到函数 ${message.key}`);
        return;
      }

      // 还原缩进：将归一化的代码恢复原始缩进
      const restoredCode = this.denormalizeIndentation(message.code, message.baseIndent || '');

      // 精准替换：只替换函数部分，保留前后所有内容
      const before = luaCode.substring(0, result.node.range[0]);
      const after = luaCode.substring(result.node.range[1]);
      const newCode = before + restoredCode + after;

      // 写入源文件
      fs.writeFileSync(luaPath, newCode, 'utf-8');

      // 清除缓存
      this.luaLinker.clearCache(luaPath);

      vscode.window.showInformationMessage(`已保存 ${message.key}`);
    } catch (error) {
      vscode.window.showErrorMessage(
        `保存失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
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

      /* Overlay 容器 */
      .code-overlay-container {
        position: relative;
        width: 100%;
        border: 1px solid var(--input-border);
        border-radius: 6px;
        overflow: hidden;
        background: var(--vscode-textCodeBlock-background, var(--input-bg));
        transition: border-color 0.15s, box-shadow 0.15s;
      }

      .code-overlay-container:focus-within {
        border-color: var(--color-accent);
        box-shadow: 0 0 0 2px rgba(9, 105, 218, 0.15);
      }

      /* 高亮层 (在下方) */
      .code-highlight-pre {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        margin: 0;
        padding: 10px 14px;
        font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
        font-size: 12px;
        line-height: 1.6;
        tab-size: 4;
        white-space: pre;
        overflow: auto;
        pointer-events: none;
        z-index: 1;
        background: transparent;
      }

      .code-highlight-pre code.hljs {
        font-family: inherit;
        font-size: inherit;
        line-height: inherit;
        background: transparent;
        padding: 0;
        border-radius: 0;
        white-space: pre;
        display: block;
      }

      /* 编辑层 (在上方, 文字透明) */
      .code-overlay-textarea {
        display: block;
        position: relative;
        width: 100%;
        margin: 0;
        padding: 10px 14px;
        font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
        font-size: 12px;
        line-height: 1.6;
        tab-size: 4;
        background: transparent;
        color: transparent;
        caret-color: var(--input-fg);
        border: none;
        resize: vertical;
        white-space: pre;
        overflow-wrap: normal;
        overflow: auto;
        z-index: 2;
        outline: none;
      }

      .code-overlay-textarea::selection {
        background: rgba(9, 105, 218, 0.3);
      }

      /* ========== highlight.js 主题 (VS Code 自适应) ========== */
      .hljs {
        color: var(--vscode-editor-foreground);
        background: transparent;
      }

      /* 深色主题 */
      .hljs-keyword, .hljs-selector-tag { color: #569cd6; }
      .hljs-literal { color: #569cd6; }
      .hljs-string, .hljs-template-variable { color: #ce9178; }
      .hljs-comment, .hljs-quote { color: #6a9955; font-style: italic; }
      .hljs-number, .hljs-symbol { color: #b5cea8; }
      .hljs-title, .hljs-title.function_ { color: #dcdcaa; }
      .hljs-built_in { color: #4ec9b0; }
      .hljs-variable, .hljs-attr { color: #9cdcfe; }
      .hljs-type, .hljs-title.class_ { color: #4ec9b0; }
      .hljs-meta, .hljs-meta .hljs-keyword { color: #569cd6; }
      .hljs-params { color: #9cdcfe; }
      .hljs-section { color: #dcdcaa; }
      .hljs-name { color: #569cd6; }
      .hljs-attribute { color: #9cdcfe; }
      .hljs-addition { color: #b5cea8; }
      .hljs-deletion { color: #ce9178; }

      /* 浅色主题覆盖 */
      body.vscode-light .hljs-keyword, body.vscode-light .hljs-selector-tag { color: #0000ff; }
      body.vscode-light .hljs-literal { color: #0000ff; }
      body.vscode-light .hljs-string, body.vscode-light .hljs-template-variable { color: #a31515; }
      body.vscode-light .hljs-comment, body.vscode-light .hljs-quote { color: #008000; }
      body.vscode-light .hljs-number, body.vscode-light .hljs-symbol { color: #098658; }
      body.vscode-light .hljs-title, body.vscode-light .hljs-title.function_ { color: #795e26; }
      body.vscode-light .hljs-built_in { color: #267f99; }
      body.vscode-light .hljs-variable, body.vscode-light .hljs-attr { color: #001080; }
      body.vscode-light .hljs-type, body.vscode-light .hljs-title.class_ { color: #267f99; }
      body.vscode-light .hljs-meta, body.vscode-light .hljs-meta .hljs-keyword { color: #0000ff; }
      body.vscode-light .hljs-params { color: #001080; }
      body.vscode-light .hljs-name { color: #800000; }
      body.vscode-light .hljs-attribute { color: #e50000; }
      body.vscode-light .hljs-addition { color: #098658; }
      body.vscode-light .hljs-deletion { color: #a31515; }

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
    // 创建块数据映射（包含代码块的归一化信息）
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
      const highlightTimers = {};

      /* ========== 监听来自扩展的消息（语法高亮结果） ========== */
      window.addEventListener('message', function(event) {
        var msg = event.data;
        switch (msg.type) {
          case 'highlightResult': {
            var codeEl = document.getElementById(msg.blockId + '-highlight');
            if (codeEl) codeEl.innerHTML = msg.html;
            break;
          }
        }
      });

      /* ========== 通用控件函数 ========== */
      function updateValue(blockId) {
        const input = document.getElementById(blockId);
        const data = blockData[blockId];
        if (!input || !data) return;

        let value;
        if (input.type === 'checkbox') {
          value = input.checked;
          const label = input.closest('.switch').querySelector('.switch-label');
          if (label) label.textContent = value ? '开启' : '关闭';
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

      /* ========== 代码编辑器：高亮 + 重置 + 修改检测 ========== */

      /** 请求扩展侧进行语法高亮（带去抖） */
      function requestHighlight(blockId) {
        const textarea = document.getElementById(blockId);
        const data = blockData[blockId];
        if (!textarea || !data) return;

        clearTimeout(highlightTimers[blockId]);
        highlightTimers[blockId] = setTimeout(function() {
          vscode.postMessage({
            type: 'requestHighlight',
            blockId: blockId,
            code: textarea.value,
            lang: data.lang || 'lua'
          });
        }, 250);
      }

      /** textarea 输入时：检测修改 + 请求高亮 */
      function onCodeInput(blockId) {
        const textarea = document.getElementById(blockId);
        const data = blockData[blockId];
        if (!textarea || !data) return;

        // 检测是否有修改
        const modified = textarea.value !== data.originalCode;
        const hint = document.getElementById(blockId + '-modified');
        if (hint) hint.style.display = modified ? 'flex' : 'none';

        // 请求语法高亮
        requestHighlight(blockId);
      }

      /** 同步 textarea 与 pre 的滚动位置 */
      function syncScroll(blockId) {
        const textarea = document.getElementById(blockId);
        const pre = document.getElementById(blockId + '-pre');
        if (textarea && pre) {
          pre.scrollTop = textarea.scrollTop;
          pre.scrollLeft = textarea.scrollLeft;
        }
      }

      /** 重置代码到原始内容 */
      function resetCode(blockId) {
        const textarea = document.getElementById(blockId);
        const data = blockData[blockId];
        if (!textarea || !data) return;

        textarea.value = data.originalCode;

        // 隐藏修改提示
        const hint = document.getElementById(blockId + '-modified');
        if (hint) hint.style.display = 'none';

        // 重新请求高亮
        requestHighlight(blockId);
      }

      /** 保存代码（还原缩进后发送） */
      function saveCode(blockId) {
        const textarea = document.getElementById(blockId);
        const data = blockData[blockId];
        if (!textarea || !data) return;

        vscode.postMessage({
          type: 'saveCode',
          file: data.file,
          key: data.key,
          code: textarea.value,
          baseIndent: data.baseIndent || ''
        });

        // 保存后更新 originalCode 基线
        data.originalCode = textarea.value;
        const hint = document.getElementById(blockId + '-modified');
        if (hint) hint.style.display = 'none';

        // 闪烁动画
        const block = textarea.closest('.config-block');
        if (block) {
          block.classList.remove('updated');
          void block.offsetWidth;
          block.classList.add('updated');
        }
      }

      function handleCodeKeydown(event, blockId) {
        // Tab 插入制表符
        if (event.key === 'Tab') {
          event.preventDefault();
          const ta = document.getElementById(blockId);
          if (!ta) return;
          const start = ta.selectionStart;
          const end = ta.selectionEnd;
          ta.value = ta.value.substring(0, start) + '    ' + ta.value.substring(end);
          ta.selectionStart = ta.selectionEnd = start + 4;
          onCodeInput(blockId);
        }
        // Ctrl+S / Cmd+S 保存
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
          event.preventDefault();
          saveCode(blockId);
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
