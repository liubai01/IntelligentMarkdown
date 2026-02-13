/**
 * 显示 Lua 变量值命令
 * 在命令面板中选择配置块并显示详细信息
 */

import * as vscode from 'vscode';
import { ConfigBlockParser } from '../core/parser/configBlockParser';
import { LuaLinker, LinkedConfigBlock } from '../core/linker/luaLinker';

export async function showVariableValueCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    vscode.window.showWarningMessage('请先打开一个 Markdown 文件');
    return;
  }

  if (editor.document.languageId !== 'markdown') {
    vscode.window.showWarningMessage('当前文件不是 Markdown 文件');
    return;
  }

  const configParser = new ConfigBlockParser();
  const luaLinker = new LuaLinker();

  const text = editor.document.getText();
  const blocks = configParser.parseMarkdown(text);

  if (blocks.length === 0) {
    vscode.window.showInformationMessage('当前文档中没有找到 lua-config 配置块');
    return;
  }

  // 链接到 Lua 文件
  const linkedBlocks = await luaLinker.linkBlocks(blocks, editor.document.uri.fsPath);

  // 创建选择项
  const items: vscode.QuickPickItem[] = linkedBlocks.map(block => {
    const statusIcon = block.linkStatus === 'ok' ? '✅' : '❌';
    const valueText = block.linkStatus === 'ok'
      ? formatValue(block.currentValue)
      : block.linkError || '错误';

    return {
      label: `${statusIcon} ${block.key}`,
      description: `${block.type} | ${block.file}`,
      detail: `当前值: ${valueText}`,
      // 存储额外数据
      alwaysShow: true
    } as vscode.QuickPickItem & { block: LinkedConfigBlock };
  });

  // 显示快速选择
  const selected = await vscode.window.showQuickPick(items, {
    title: 'Lua 变量绑定',
    placeHolder: '选择一个配置查看详情或跳转',
    matchOnDescription: true,
    matchOnDetail: true
  });

  if (selected) {
    // 找到对应的 block
    const index = items.indexOf(selected);
    const block = linkedBlocks[index];

    if (block.linkStatus === 'ok' && block.luaNode) {
      // 提供操作选项
      const action = await vscode.window.showQuickPick([
        { label: '📍 跳转到 Lua 源码', action: 'goto' },
        { label: '📋 复制当前值', action: 'copy' },
        { label: '📝 查看详细信息', action: 'detail' }
      ], {
        title: block.key,
        placeHolder: '选择操作'
      });

      if (action) {
        switch (action.action) {
          case 'goto':
            await gotoLuaSource(block);
            break;
          case 'copy':
            await copyValue(block);
            break;
          case 'detail':
            await showDetailInfo(block);
            break;
        }
      }
    } else {
      vscode.window.showErrorMessage(`链接错误: ${block.linkError}`);
    }
  }
}

/**
 * 跳转到 Lua 源码
 */
async function gotoLuaSource(block: LinkedConfigBlock): Promise<void> {
  if (!block.luaNode) {
    return;
  }

  const uri = vscode.Uri.file(block.absoluteFilePath);
  const document = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(document);

  const position = new vscode.Position(
    block.luaNode.loc.start.line - 1,
    block.luaNode.loc.start.column
  );

  editor.selection = new vscode.Selection(position, position);
  editor.revealRange(
    new vscode.Range(position, position),
    vscode.TextEditorRevealType.InCenter
  );
}

/**
 * 复制值到剪贴板
 */
async function copyValue(block: LinkedConfigBlock): Promise<void> {
  const valueText = typeof block.currentValue === 'object'
    ? JSON.stringify(block.currentValue, null, 2)
    : String(block.currentValue);

  await vscode.env.clipboard.writeText(valueText);
  vscode.window.showInformationMessage(`已复制: ${valueText.substring(0, 50)}${valueText.length > 50 ? '...' : ''}`);
}

/**
 * 显示详细信息
 */
async function showDetailInfo(block: LinkedConfigBlock): Promise<void> {
  const panel = vscode.window.createWebviewPanel(
    'luaConfigDetail',
    `配置详情: ${block.key}`,
    vscode.ViewColumn.Beside,
    {}
  );

  panel.webview.html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: var(--vscode-font-family); padding: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid var(--vscode-panel-border); padding: 8px; text-align: left; }
        th { background: var(--vscode-editor-background); }
        code { background: var(--vscode-textCodeBlock-background); padding: 2px 6px; border-radius: 3px; }
        pre { background: var(--vscode-textCodeBlock-background); padding: 10px; overflow: auto; }
      </style>
    </head>
    <body>
      <h2>🔗 ${block.key}</h2>
      <table>
        <tr><th>属性</th><th>值</th></tr>
        <tr><td>文件</td><td><code>${block.absoluteFilePath}</code></td></tr>
        <tr><td>变量路径</td><td><code>${block.key}</code></td></tr>
        <tr><td>控件类型</td><td><code>${block.type}</code></td></tr>
        <tr><td>标签</td><td>${block.label || '-'}</td></tr>
        ${block.min !== undefined ? `<tr><td>最小值</td><td>${block.min}</td></tr>` : ''}
        ${block.max !== undefined ? `<tr><td>最大值</td><td>${block.max}</td></tr>` : ''}
        ${block.step !== undefined ? `<tr><td>步进</td><td>${block.step}</td></tr>` : ''}
        ${block.unit ? `<tr><td>单位</td><td>${block.unit}</td></tr>` : ''}
        <tr><td>位置</td><td>第 ${block.luaNode?.loc.start.line} 行, 第 ${block.luaNode?.loc.start.column} 列</td></tr>
      </table>
      <h3>当前值</h3>
      <pre>${typeof block.currentValue === 'object' ? JSON.stringify(block.currentValue, null, 2) : block.currentValue}</pre>
    </body>
    </html>
  `;
}

/**
 * 格式化值用于显示
 */
function formatValue(value: any): string {
  if (value === null || value === undefined) {
    return 'nil';
  }

  if (typeof value === 'object') {
    try {
      const json = JSON.stringify(value);
      return json.length > 50 ? json.substring(0, 47) + '...' : json;
    } catch {
      return '[对象]';
    }
  }

  if (typeof value === 'string') {
    return value.length > 30 ? `"${value.substring(0, 27)}..."` : `"${value}"`;
  }

  return String(value);
}
