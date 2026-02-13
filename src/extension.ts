/**
 * Intelligent Markdown for Lua
 * VS Code 插件入口
 */

import * as vscode from 'vscode';
import * as path from 'path';
import {
  LuaConfigDocumentLinkProvider,
  LuaConfigHoverProvider,
  LuaConfigDecorationProvider
} from './providers';
import { showVariableValueCommand } from './commands';
import { SmartMarkdownEditorProvider } from './editor/smartMarkdownEditor';

let decorationProvider: LuaConfigDecorationProvider | undefined;

// 记录已打开预览的文件，避免重复打开
const openedPreviews = new Set<string>();

/**
 * 插件激活
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('Intelligent Markdown for Lua 已激活');

  // 注册文档链接提供者
  const linkProvider = new LuaConfigDocumentLinkProvider();
  context.subscriptions.push(
    vscode.languages.registerDocumentLinkProvider(
      { language: 'markdown', scheme: 'file' },
      linkProvider
    )
  );

  // 注册悬停提示提供者
  const hoverProvider = new LuaConfigHoverProvider();
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      { language: 'markdown', scheme: 'file' },
      hoverProvider
    )
  );

  // 注册装饰器提供者
  decorationProvider = new LuaConfigDecorationProvider(context);
  context.subscriptions.push({
    dispose: () => decorationProvider?.dispose()
  });

  // 注册命令：显示变量值
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'intelligentMarkdown.showVariableValue',
      showVariableValueCommand
    )
  );

  // 注册命令：刷新绑定
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'intelligentMarkdown.refreshBindings',
      () => {
        vscode.window.showInformationMessage('正在刷新 Lua 绑定...');
        if (vscode.window.activeTextEditor) {
          decorationProvider?.dispose();
          decorationProvider = new LuaConfigDecorationProvider(context);
        }
        vscode.window.showInformationMessage('Lua 绑定已刷新');
      }
    )
  );

  // 注册命令：打开配置预览
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'intelligentMarkdown.openPreview',
      () => openPreviewPanel(context)
    )
  );

  // 监听 Lua 文件变化
  const luaWatcher = vscode.workspace.createFileSystemWatcher('**/*.lua');

  luaWatcher.onDidChange(uri => {
    console.log(`Lua 文件已修改: ${uri.fsPath}`);
    if (decorationProvider) {
      decorationProvider.dispose();
      decorationProvider = new LuaConfigDecorationProvider(context);
    }
  });

  context.subscriptions.push(luaWatcher);

  // 监听文档打开，自动显示预览
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) {
        handleAutoOpenPreview(context, editor.document);
      }
    })
  );

  // 如果当前已经有打开的 Markdown 文件，检查是否需要自动打开预览
  if (vscode.window.activeTextEditor) {
    handleAutoOpenPreview(context, vscode.window.activeTextEditor.document);
  }

  // 输出激活信息
  vscode.window.showInformationMessage('Intelligent Markdown for Lua 已启动');
}

/**
 * 处理自动打开预览
 */
async function handleAutoOpenPreview(
  context: vscode.ExtensionContext,
  document: vscode.TextDocument
): Promise<void> {
  // 检查是否是 Markdown 文件
  if (document.languageId !== 'markdown') {
    return;
  }

  // 避免重复打开
  if (openedPreviews.has(document.uri.toString())) {
    return;
  }

  // 读取配置
  const config = vscode.workspace.getConfiguration('intelligentMarkdown');
  const autoOpenPreview = config.get<boolean>('autoOpenPreview', false);

  if (!autoOpenPreview) {
    return;
  }

  // 检查文件匹配模式
  const pattern = config.get<string>('autoOpenPreviewPattern', '**/*.config.md');
  
  // 使用简单的 glob 匹配
  if (!matchGlobPattern(document.uri.fsPath, pattern)) {
    return;
  }

  // 检查是否需要包含 lua-config 块
  const onlyWithLuaConfig = config.get<boolean>('autoOpenPreviewOnlyWithLuaConfig', true);
  
  if (onlyWithLuaConfig) {
    const content = document.getText();
    if (!content.includes('```lua-config')) {
      return;
    }
  }

  // 标记为已打开
  openedPreviews.add(document.uri.toString());

  // 延迟一下打开预览，让编辑器先完成加载
  setTimeout(() => {
    openPreviewForDocument(context, document);
  }, 300);
}

/**
 * 简单的 glob 模式匹配
 */
function matchGlobPattern(filePath: string, pattern: string): boolean {
  // 标准化路径
  const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();
  const normalizedPattern = pattern.replace(/\\/g, '/').toLowerCase();

  // 如果模式是 ** 开头，匹配任意路径
  if (normalizedPattern.startsWith('**/')) {
    const suffix = normalizedPattern.slice(3);
    return matchSimplePattern(normalizedPath, suffix);
  }

  // 如果模式是 *.xxx，匹配文件扩展名
  if (normalizedPattern.startsWith('*.')) {
    const ext = normalizedPattern.slice(1);
    return normalizedPath.endsWith(ext);
  }

  // 简单匹配
  return matchSimplePattern(normalizedPath, normalizedPattern);
}

/**
 * 简单模式匹配（支持 * 和 ?）
 */
function matchSimplePattern(str: string, pattern: string): boolean {
  // 将 glob 转换为正则表达式
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.');
  
  const regex = new RegExp(regexPattern + '$', 'i');
  return regex.test(str);
}

/**
 * 为指定文档打开预览
 */
async function openPreviewForDocument(
  context: vscode.ExtensionContext,
  document: vscode.TextDocument
): Promise<void> {
  // 创建 Webview 面板
  const panel = vscode.window.createWebviewPanel(
    'intelligentMarkdown.preview',
    `配置预览: ${path.basename(document.fileName)}`,
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [context.extensionUri]
    }
  );

  // 监听面板关闭，从已打开列表中移除
  panel.onDidDispose(() => {
    openedPreviews.delete(document.uri.toString());
  });

  // 使用 SmartMarkdownEditorProvider 的逻辑
  const editorProvider = new SmartMarkdownEditorProvider(context);
  await editorProvider.resolveCustomTextEditor(
    document,
    panel,
    new vscode.CancellationTokenSource().token
  );
}

/**
 * 打开预览面板
 */
async function openPreviewPanel(context: vscode.ExtensionContext): Promise<void> {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    vscode.window.showWarningMessage('请先打开一个 Markdown 文件');
    return;
  }

  if (editor.document.languageId !== 'markdown') {
    vscode.window.showWarningMessage('当前文件不是 Markdown 文件');
    return;
  }

  // 创建 Webview 面板
  const panel = vscode.window.createWebviewPanel(
    'intelligentMarkdown.preview',
    `配置预览: ${editor.document.fileName.split(/[\\/]/).pop()}`,
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [context.extensionUri]
    }
  );

  // 使用 SmartMarkdownEditorProvider 的逻辑
  const editorProvider = new SmartMarkdownEditorProvider(context);
  await editorProvider.resolveCustomTextEditor(editor.document, panel, new vscode.CancellationTokenSource().token);
}

/**
 * 插件停用
 */
export function deactivate(): void {
  console.log('Intelligent Markdown for Lua 已停用');
  decorationProvider?.dispose();
}
