/**
 * Show Lua variable value command
 * Select a config block from command palette and display details
 */

import * as vscode from 'vscode';
import { ConfigBlockParser } from '../core/parser/configBlockParser';
import { LuaLinker, LinkedConfigBlock } from '../core/linker/luaLinker';

export async function showVariableValueCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    vscode.window.showWarningMessage(vscode.l10n.t('Please open a Markdown file first'));
    return;
  }

  if (editor.document.languageId !== 'markdown') {
    vscode.window.showWarningMessage(vscode.l10n.t('Current file is not a Markdown file'));
    return;
  }

  const configParser = new ConfigBlockParser();
  const luaLinker = new LuaLinker();

  const text = editor.document.getText();
  const blocks = configParser.parseMarkdown(text);

  if (blocks.length === 0) {
    vscode.window.showInformationMessage(vscode.l10n.t('No lua-config blocks found in current document'));
    return;
  }

  // Link to Lua files
  const linkedBlocks = await luaLinker.linkBlocks(blocks, editor.document.uri.fsPath);

  // Create selection items
  const items: vscode.QuickPickItem[] = linkedBlocks.map(block => {
    const statusIcon = block.linkStatus === 'ok' ? '✅' : '❌';
    const valueText = block.linkStatus === 'ok'
      ? formatValue(block.currentValue)
      : block.linkError || vscode.l10n.t('Error');

    return {
      label: `${statusIcon} ${block.key}`,
      description: `${block.type} | ${block.file}`,
      detail: vscode.l10n.t('Current value: {0}', valueText),
      alwaysShow: true
    } as vscode.QuickPickItem & { block: LinkedConfigBlock };
  });

  // Show quick pick
  const selected = await vscode.window.showQuickPick(items, {
    title: vscode.l10n.t('Lua Variable Bindings'),
    placeHolder: vscode.l10n.t('Select a config to view details or navigate'),
    matchOnDescription: true,
    matchOnDetail: true
  });

  if (selected) {
    // Find the corresponding block
    const index = items.indexOf(selected);
    const block = linkedBlocks[index];

    if (block.linkStatus === 'ok' && block.luaNode) {
      // Provide action options
      const action = await vscode.window.showQuickPick([
        { label: `📍 ${vscode.l10n.t('Jump to Lua Source')}`, action: 'goto' },
        { label: `📋 ${vscode.l10n.t('Copy Current Value')}`, action: 'copy' },
        { label: `📝 ${vscode.l10n.t('View Details')}`, action: 'detail' }
      ], {
        title: block.key,
        placeHolder: vscode.l10n.t('Choose action')
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
      vscode.window.showErrorMessage(vscode.l10n.t('Link error: {0}', block.linkError || ''));
    }
  }
}

/**
 * Find if a file is already open in an editor tab and return its ViewColumn.
 * Checks visible editors first, then scans recent tabs across all groups.
 */
function findOpenEditorColumn(uri: vscode.Uri): vscode.ViewColumn | undefined {
  const visibleEditor = vscode.window.visibleTextEditors.find(
    e => e.document.uri.fsPath === uri.fsPath
  );
  if (visibleEditor?.viewColumn) {
    return visibleEditor.viewColumn;
  }

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
 * Jump to Lua source (smart: reuse open tabs)
 */
async function gotoLuaSource(block: LinkedConfigBlock): Promise<void> {
  if (!block.luaNode) {
    return;
  }

  const uri = vscode.Uri.file(block.absoluteFilePath);
  const position = new vscode.Position(
    block.luaNode.loc.start.line - 1,
    block.luaNode.loc.start.column
  );
  const targetColumn = findOpenEditorColumn(uri);

  const document = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(document, {
    viewColumn: targetColumn,
    preserveFocus: false
  });

  editor.selection = new vscode.Selection(position, position);
  editor.revealRange(
    new vscode.Range(position, position),
    vscode.TextEditorRevealType.InCenter
  );
}

/**
 * Copy value to clipboard
 */
async function copyValue(block: LinkedConfigBlock): Promise<void> {
  const valueText = typeof block.currentValue === 'object'
    ? JSON.stringify(block.currentValue, null, 2)
    : String(block.currentValue);

  await vscode.env.clipboard.writeText(valueText);
  vscode.window.showInformationMessage(vscode.l10n.t('Copied: {0}', valueText.substring(0, 50) + (valueText.length > 50 ? '...' : '')));
}

/**
 * Show detail info
 */
async function showDetailInfo(block: LinkedConfigBlock): Promise<void> {
  const t = vscode.l10n.t;

  const panel = vscode.window.createWebviewPanel(
    'luaConfigDetail',
    t('Config Details: {0}', block.key),
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
        <tr><th>${t('Property')}</th><th>${t('Value')}</th></tr>
        <tr><td>${t('File')}</td><td><code>${block.absoluteFilePath}</code></td></tr>
        <tr><td>${t('Variable Path')}</td><td><code>${block.key}</code></td></tr>
        <tr><td>${t('Control Type')}</td><td><code>${block.type}</code></td></tr>
        <tr><td>${t('Label')}</td><td>${block.label || '-'}</td></tr>
        ${block.min !== undefined ? `<tr><td>${t('Min')}</td><td>${block.min}</td></tr>` : ''}
        ${block.max !== undefined ? `<tr><td>${t('Max')}</td><td>${block.max}</td></tr>` : ''}
        ${block.step !== undefined ? `<tr><td>${t('Step')}</td><td>${block.step}</td></tr>` : ''}
        ${block.unit ? `<tr><td>${t('Unit')}</td><td>${block.unit}</td></tr>` : ''}
        <tr><td>${t('Position')}</td><td>${t('Line {0}, Column {1}', block.luaNode?.loc.start.line ?? '', block.luaNode?.loc.start.column ?? '')}</td></tr>
      </table>
      <h3>${t('Current Value')}</h3>
      <pre>${typeof block.currentValue === 'object' ? JSON.stringify(block.currentValue, null, 2) : block.currentValue}</pre>
    </body>
    </html>
  `;
}

/**
 * Format value for display
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
      return `[${vscode.l10n.t('Object')}]`;
    }
  }

  if (typeof value === 'string') {
    return value.length > 30 ? `"${value.substring(0, 27)}..."` : `"${value}"`;
  }

  return String(value);
}
