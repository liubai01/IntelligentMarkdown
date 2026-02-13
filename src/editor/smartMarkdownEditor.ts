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
    let valueDisplay = '';

    if (block.linkStatus === 'ok') {
      valueDisplay = this.formatValue(block.currentValue);

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
   * 简单的 Markdown 转 HTML
   */
  private simpleMarkdownToHtml(text: string): string {
    return text
      // 标题
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      // 引用
      .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
      // 粗体
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // 斜体
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // 代码
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // 段落
      .replace(/\n\n/g, '</p><p>')
      // 换行
      .replace(/\n/g, '<br>');
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
    if (value === null || value === undefined) return 'nil';
    if (typeof value === 'object') return JSON.stringify(value);
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
   * 获取样式
   */
  private getStyles(): string {
    return `
      :root {
        --bg-color: var(--vscode-editor-background);
        --fg-color: var(--vscode-editor-foreground);
        --border-color: var(--vscode-panel-border);
        --input-bg: var(--vscode-input-background);
        --input-fg: var(--vscode-input-foreground);
        --input-border: var(--vscode-input-border);
        --button-bg: var(--vscode-button-background);
        --button-fg: var(--vscode-button-foreground);
        --accent-color: var(--vscode-focusBorder);
        --success-color: #4caf50;
        --error-color: #f44336;
      }

      * {
        box-sizing: border-box;
      }

      body {
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
        color: var(--fg-color);
        background: var(--bg-color);
        padding: 0;
        margin: 0;
        line-height: 1.6;
      }

      .container {
        max-width: 900px;
        margin: 0 auto;
        padding: 20px;
      }

      .toolbar {
        position: sticky;
        top: 0;
        background: var(--bg-color);
        padding: 10px 0;
        border-bottom: 1px solid var(--border-color);
        margin-bottom: 20px;
        z-index: 100;
      }

      .toolbar button {
        background: var(--button-bg);
        color: var(--button-fg);
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
      }

      .toolbar button:hover {
        opacity: 0.9;
      }

      h1, h2, h3 {
        margin-top: 24px;
        margin-bottom: 16px;
        font-weight: 600;
      }

      h1 { font-size: 2em; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; }
      h2 { font-size: 1.5em; }
      h3 { font-size: 1.25em; }

      blockquote {
        margin: 16px 0;
        padding: 10px 20px;
        border-left: 4px solid var(--accent-color);
        background: rgba(128, 128, 128, 0.1);
        border-radius: 0 4px 4px 0;
      }

      code {
        background: rgba(128, 128, 128, 0.2);
        padding: 2px 6px;
        border-radius: 3px;
        font-family: var(--vscode-editor-font-family);
      }

      /* 配置块样式 */
      .config-block {
        background: var(--input-bg);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 16px;
        margin: 16px 0;
        transition: all 0.2s;
      }

      .config-block:hover {
        border-color: var(--accent-color);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .config-block.status-error {
        border-color: var(--error-color);
        background: rgba(244, 67, 54, 0.05);
      }

      .config-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 12px;
        flex-wrap: wrap;
      }

      .status-icon {
        font-size: 16px;
      }

      .config-label {
        font-weight: 600;
        font-size: 15px;
      }

      .config-key {
        font-family: var(--vscode-editor-font-family);
        font-size: 12px;
        color: rgba(128, 128, 128, 0.8);
        background: rgba(128, 128, 128, 0.1);
        padding: 2px 8px;
        border-radius: 4px;
      }

      .goto-btn {
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        opacity: 0.6;
        transition: opacity 0.2s;
      }

      .goto-btn:hover {
        opacity: 1;
        background: rgba(128, 128, 128, 0.2);
      }

      .config-input {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .config-unit {
        font-size: 13px;
        color: rgba(128, 128, 128, 0.8);
        margin-left: 8px;
      }

      .error-message {
        color: var(--error-color);
        font-size: 13px;
      }

      /* 数字输入 */
      .number-input-wrapper {
        display: flex;
        align-items: center;
        gap: 0;
      }

      .number-input {
        width: 120px;
        padding: 8px 12px;
        border: 1px solid var(--input-border);
        border-radius: 0;
        background: var(--input-bg);
        color: var(--input-fg);
        font-size: 16px;
        font-weight: 600;
        text-align: center;
        -moz-appearance: textfield;
      }

      .number-input::-webkit-outer-spin-button,
      .number-input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }

      .number-input:focus {
        outline: none;
        border-color: var(--accent-color);
      }

      .num-btn {
        width: 36px;
        height: 36px;
        border: 1px solid var(--input-border);
        background: var(--button-bg);
        color: var(--button-fg);
        font-size: 18px;
        font-weight: bold;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }

      .num-btn.minus {
        border-radius: 6px 0 0 6px;
        border-right: none;
      }

      .num-btn.plus {
        border-radius: 0 6px 6px 0;
        border-left: none;
      }

      .num-btn:hover {
        background: var(--accent-color);
      }

      .num-btn:active {
        transform: scale(0.95);
      }

      .range-hint {
        font-size: 12px;
        color: rgba(128, 128, 128, 0.7);
        margin-left: 12px;
      }

      /* 滑动条 */
      .slider-wrapper {
        flex: 1;
        max-width: 400px;
      }

      .slider-input {
        width: 100%;
        height: 8px;
        border-radius: 4px;
        background: rgba(128, 128, 128, 0.3);
        outline: none;
        -webkit-appearance: none;
        cursor: pointer;
      }

      .slider-input::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: var(--accent-color);
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        transition: transform 0.2s;
      }

      .slider-input::-webkit-slider-thumb:hover {
        transform: scale(1.1);
      }

      .slider-labels {
        display: flex;
        justify-content: space-between;
        margin-top: 8px;
        font-size: 12px;
        color: rgba(128, 128, 128, 0.8);
      }

      .slider-value {
        font-weight: 600;
        font-size: 16px;
        color: var(--accent-color);
        min-width: 60px;
        text-align: center;
      }

      /* 开关 */
      .switch {
        display: flex;
        align-items: center;
        gap: 12px;
        cursor: pointer;
      }

      .switch input {
        display: none;
      }

      .switch-slider {
        width: 50px;
        height: 26px;
        background: rgba(128, 128, 128, 0.4);
        border-radius: 13px;
        position: relative;
        transition: all 0.3s;
      }

      .switch-slider::after {
        content: '';
        position: absolute;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: white;
        top: 2px;
        left: 2px;
        transition: all 0.3s;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }

      .switch input:checked + .switch-slider {
        background: var(--success-color);
      }

      .switch input:checked + .switch-slider::after {
        left: 26px;
      }

      .switch-label {
        font-size: 14px;
      }

      /* 字符串输入 */
      .string-input {
        flex: 1;
        max-width: 400px;
        padding: 8px 12px;
        border: 1px solid var(--input-border);
        border-radius: 6px;
        background: var(--input-bg);
        color: var(--input-fg);
        font-size: 14px;
      }

      .string-input:focus {
        outline: none;
        border-color: var(--accent-color);
      }

      /* 下拉选择 */
      .select-input {
        min-width: 200px;
        padding: 8px 12px;
        border: 1px solid var(--input-border);
        border-radius: 6px;
        background: var(--input-bg);
        color: var(--input-fg);
        font-size: 14px;
        cursor: pointer;
      }

      .select-input:focus {
        outline: none;
        border-color: var(--accent-color);
      }

      /* 动画 */
      @keyframes highlight {
        0% { background-color: rgba(76, 175, 80, 0.3); }
        100% { background-color: transparent; }
      }

      .config-block.updated {
        animation: highlight 1s ease-out;
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
