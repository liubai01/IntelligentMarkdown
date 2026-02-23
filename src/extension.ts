/**
 * Intelligent Markdown for Lua
 * VS Code extension entry point
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
  LuaConfigDocumentLinkProvider,
  LuaConfigHoverProvider,
  LuaConfigDecorationProvider,
  LuaDocLinkProvider
} from './providers';
import { showVariableValueCommand } from './commands';
import { SmartMarkdownEditorProvider } from './editor/smartMarkdownEditor';

let decorationProvider: LuaConfigDecorationProvider | undefined;

// Current active preview panel (reuse to avoid creating too many windows)
let currentPreviewPanel: vscode.WebviewPanel | undefined;
let currentPreviewDocUri: string | undefined;

/**
 * Extension activation
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('Intelligent Markdown for Lua activated');

  // Register document link provider
  const linkProvider = new LuaConfigDocumentLinkProvider();
  context.subscriptions.push(
    vscode.languages.registerDocumentLinkProvider(
      { language: 'markdown', scheme: 'file' },
      linkProvider
    )
  );

  // Register Lua doc link provider (-- @doc: comments in Lua files)
  const luaDocLinkProvider = new LuaDocLinkProvider();
  context.subscriptions.push(
    vscode.languages.registerDocumentLinkProvider(
      { language: 'lua', scheme: 'file' },
      luaDocLinkProvider
    )
  );

  // Register hover provider
  const hoverProvider = new LuaConfigHoverProvider();
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      { language: 'markdown', scheme: 'file' },
      hoverProvider
    )
  );

  // Register decoration provider
  decorationProvider = new LuaConfigDecorationProvider(context);
  context.subscriptions.push({
    dispose: () => decorationProvider?.dispose()
  });

  // Register command: show variable value
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'intelligentMarkdown.showVariableValue',
      showVariableValueCommand
    )
  );

  // Register command: refresh bindings
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'intelligentMarkdown.refreshBindings',
      () => {
        vscode.window.showInformationMessage(vscode.l10n.t('Refreshing Lua bindings...'));
        if (vscode.window.activeTextEditor) {
          decorationProvider?.dispose();
          decorationProvider = new LuaConfigDecorationProvider(context);
        }
        vscode.window.showInformationMessage(vscode.l10n.t('Lua bindings refreshed'));
      }
    )
  );

  // Register command: open config preview
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'intelligentMarkdown.openPreview',
      () => openPreviewPanel(context)
    )
  );

  // Register command: goto probe location (smart: reuse open tabs)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'intelligentMarkdown.gotoProbe',
      async (filePath: string, line: number, markdownFsPath?: string) => {
        try {
          const uri = vscode.Uri.file(filePath);
          const position = new vscode.Position(Math.max(0, line - 1), 0);

          // 1. Check if target file is already open
          let targetColumn = findOpenEditorColumn(uri);

          // 2. If not open, try to open in the same column as the Markdown source
          if (targetColumn === undefined && markdownFsPath) {
            targetColumn = findOpenEditorColumn(vscode.Uri.file(markdownFsPath));
          }

          const document = await vscode.workspace.openTextDocument(uri);
          const editor = await vscode.window.showTextDocument(document, {
            viewColumn: targetColumn ?? vscode.ViewColumn.One,
            preserveFocus: false
          });

          editor.selection = new vscode.Selection(position, position);
          editor.revealRange(
            new vscode.Range(position, position),
            vscode.TextEditorRevealType.InCenter
          );
        } catch (error) {
          vscode.window.showErrorMessage(
            vscode.l10n.t('Unable to open probe target: {0}', error instanceof Error ? error.message : String(error))
          );
        }
      }
    )
  );

  // Register command: goto doc section (Lua → Markdown preview)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'intelligentMarkdown.gotoDoc',
      async (args: { mdFile: string; sectionId: string }) => {
        try {
          const mdFilePath = args.mdFile;
          const sectionId = args.sectionId;

          if (!mdFilePath) {
            vscode.window.showWarningMessage(
              vscode.l10n.t('No Markdown file found for this Lua file')
            );
            return;
          }

          // Open the Markdown document
          const mdUri = vscode.Uri.file(mdFilePath);
          const mdDocument = await vscode.workspace.openTextDocument(mdUri);

          // Open/reveal the preview panel
          await openPreviewForDocument(context, mdDocument);

          // Send scroll message to the webview after a short delay
          // to allow the webview to finish rendering
          if (currentPreviewPanel) {
            const panel = currentPreviewPanel;
            setTimeout(() => {
              panel.webview.postMessage({
                type: 'scrollToSection',
                sectionId: sectionId
              });
            }, 600);
          }
        } catch (error) {
          vscode.window.showErrorMessage(
            vscode.l10n.t('Unable to open doc target: {0}', error instanceof Error ? error.message : String(error))
          );
        }
      }
    )
  );

  // Watch source file changes (Lua + JSON)
  const luaWatcher = vscode.workspace.createFileSystemWatcher('**/*.lua');
  const jsonWatcher = vscode.workspace.createFileSystemWatcher('**/*.json');
  const jsoncWatcher = vscode.workspace.createFileSystemWatcher('**/*.jsonc');

  luaWatcher.onDidChange(uri => {
    console.log(`Lua file modified: ${uri.fsPath}`);
    if (decorationProvider) {
      decorationProvider.dispose();
      decorationProvider = new LuaConfigDecorationProvider(context);
    }
  });
  const handleJsonChange = (uri: vscode.Uri) => {
    console.log(`JSON file modified: ${uri.fsPath}`);
    if (decorationProvider) {
      decorationProvider.dispose();
      decorationProvider = new LuaConfigDecorationProvider(context);
    }
  };
  jsonWatcher.onDidChange(handleJsonChange);
  jsoncWatcher.onDidChange(handleJsonChange);

  context.subscriptions.push(luaWatcher);
  context.subscriptions.push(jsonWatcher);
  context.subscriptions.push(jsoncWatcher);

  // Watch document open for auto preview
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) {
        handleAutoOpenPreview(context, editor.document);
      }
    })
  );

  // If a Markdown file is already open, check auto-open preview
  if (vscode.window.activeTextEditor) {
    handleAutoOpenPreview(context, vscode.window.activeTextEditor.document);
  }

  // Show activation message
  vscode.window.showInformationMessage(vscode.l10n.t('Intelligent Markdown for Lua activated'));
}

/**
 * Handle auto-open preview
 */
async function handleAutoOpenPreview(
  context: vscode.ExtensionContext,
  document: vscode.TextDocument
): Promise<void> {
  // Read configuration
  const config = vscode.workspace.getConfiguration('intelligentMarkdown');
  const autoOpenPreview = config.get<boolean>('autoOpenPreview', false);

  if (!autoOpenPreview) {
    return;
  }

  // Markdown file flow: open preview directly if pattern matches
  if (document.languageId === 'markdown') {
    const pattern = config.get<string>('autoOpenPreviewPattern', '**/*.config.md');
    if (!matchGlobPattern(document.uri.fsPath, pattern)) {
      return;
    }

    // If current panel is already showing the same document, skip
    if (currentPreviewPanel && currentPreviewDocUri === document.uri.toString()) {
      return;
    }

    // Delay opening to let editor finish loading
    setTimeout(() => {
      void openPreviewForDocument(context, document);
    }, 300);
    return;
  }

  // Source file flow: read header annotation and auto-open mapped Markdown preview
  const mappedMarkdownPath = resolveMappedMarkdownPath(document);
  if (!mappedMarkdownPath) {
    return;
  }

  const mappedUri = vscode.Uri.file(mappedMarkdownPath);
  if (currentPreviewPanel && currentPreviewDocUri === mappedUri.toString()) {
    return;
  }

  // Delay opening to let editor finish loading
  setTimeout(() => {
    void vscode.workspace.openTextDocument(mappedUri)
      .then(
        mdDocument => openPreviewForDocument(context, mdDocument),
        () => undefined
      );
  }, 300);
}

/**
 * Resolve mapped config Markdown path from source file header comment.
 * Supported annotation:
 *   -- @config-md: ./foo.config.md
 *   // @config-md: ./foo.config.md
 *   # @config-md: ./foo.config.md
 */
function resolveMappedMarkdownPath(document: vscode.TextDocument): string | null {
  if (document.uri.scheme !== 'file') {
    return null;
  }

  const sourcePath = document.uri.fsPath;
  if (!/\.(lua|json|jsonc)$/i.test(sourcePath)) {
    return null;
  }

  const maxLines = Math.min(document.lineCount, 40);
  const mappingRegex = /@config-md:\s*(.+?)\s*$/i;

  for (let i = 0; i < maxLines; i++) {
    const line = document.lineAt(i).text;
    const match = mappingRegex.exec(line);
    if (!match) {
      continue;
    }

    const rawPath = match[1].trim().replace(/^['"]|['"]$/g, '');
    const resolvedPath = path.isAbsolute(rawPath)
      ? rawPath
      : path.resolve(path.dirname(sourcePath), rawPath);

    if (resolvedPath.toLowerCase().endsWith('.md') && fs.existsSync(resolvedPath)) {
      return resolvedPath;
    }
  }

  // Fallback: auto-discover by naming convention in the same folder
  const byName = discoverConfigMarkdownByName(sourcePath);
  if (byName) {
    return byName;
  }

  return null;
}

/**
 * Auto-discover mapped config markdown by filename convention.
 * Priority:
 *   1) <sourceBaseName>.config.md
 *   2) If source name ends with "_config", also try <nameWithoutConfig>.config.md
 *      Example: game_json_config.json -> game_json.config.md
 */
function discoverConfigMarkdownByName(sourcePath: string): string | null {
  const dir = path.dirname(sourcePath);
  const ext = path.extname(sourcePath);
  const baseName = path.basename(sourcePath, ext);

  const candidates: string[] = [];
  candidates.push(path.join(dir, `${baseName}.config.md`));

  const configSuffixMatch = baseName.match(/^(.*)_config$/i);
  if (configSuffixMatch && configSuffixMatch[1]) {
    candidates.push(path.join(dir, `${configSuffixMatch[1]}.config.md`));
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Simple glob pattern matching
 */
function matchGlobPattern(filePath: string, pattern: string): boolean {
  // Normalize paths
  const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();
  const normalizedPattern = pattern.replace(/\\/g, '/').toLowerCase();

  // If pattern starts with **, match any path
  if (normalizedPattern.startsWith('**/')) {
    const suffix = normalizedPattern.slice(3);
    return matchSimplePattern(normalizedPath, suffix);
  }

  // If pattern is *.xxx, match file extension
  if (normalizedPattern.startsWith('*.')) {
    const ext = normalizedPattern.slice(1);
    return normalizedPath.endsWith(ext);
  }

  // Simple match
  return matchSimplePattern(normalizedPath, normalizedPattern);
}

/**
 * Find if a file is already open in an editor tab and return its ViewColumn.
 * Checks visible editors first, then scans recent tabs across all groups.
 */
function findOpenEditorColumn(uri: vscode.Uri): vscode.ViewColumn | undefined {
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
 * Simple pattern matching (supports * and ?)
 */
function matchSimplePattern(str: string, pattern: string): boolean {
  // Convert glob to regex
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.');
  
  const regex = new RegExp(regexPattern + '$', 'i');
  return regex.test(str);
}

/**
 * Open preview for a specific document (reuse existing panel)
 */
async function openPreviewForDocument(
  context: vscode.ExtensionContext,
  document: vscode.TextDocument
): Promise<void> {
  const docUri = document.uri.toString();

  // If current panel is showing the same document, just reveal
  if (currentPreviewPanel && currentPreviewDocUri === docUri) {
    currentPreviewPanel.reveal(undefined, true);
    return;
  }

  // Determine target column: reuse existing or Beside
  let targetColumn = vscode.ViewColumn.Beside;
  if (currentPreviewPanel) {
    targetColumn = currentPreviewPanel.viewColumn || vscode.ViewColumn.Beside;
    // Dispose old panel to release resources
    currentPreviewPanel.dispose();
    currentPreviewPanel = undefined;
    currentPreviewDocUri = undefined;
  }

  // Create new Webview panel, reuse previous column position
  const panel = vscode.window.createWebviewPanel(
    'intelligentMarkdown.preview',
    vscode.l10n.t('Config Preview: {0}', path.basename(document.fileName)),
    { viewColumn: targetColumn, preserveFocus: true },
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [context.extensionUri]
    }
  );

  // Update tracking references
  currentPreviewPanel = panel;
  currentPreviewDocUri = docUri;

  // Watch panel close, clean up references
  panel.onDidDispose(() => {
    if (currentPreviewPanel === panel) {
      currentPreviewPanel = undefined;
      currentPreviewDocUri = undefined;
    }
  });

  // Use SmartMarkdownEditorProvider logic
  const editorProvider = new SmartMarkdownEditorProvider(context);
  await editorProvider.resolveCustomTextEditor(
    document,
    panel,
    new vscode.CancellationTokenSource().token
  );
}

/**
 * Open preview panel (manual command, reuse existing panel)
 */
async function openPreviewPanel(context: vscode.ExtensionContext): Promise<void> {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    vscode.window.showWarningMessage(vscode.l10n.t('Please open a Markdown file first'));
    return;
  }

  if (editor.document.languageId !== 'markdown') {
    vscode.window.showWarningMessage(vscode.l10n.t('Current file is not a Markdown file'));
    return;
  }

  // Reuse openPreviewForDocument panel reuse logic
  await openPreviewForDocument(context, editor.document);
}

/**
 * Extension deactivation
 */
export function deactivate(): void {
  console.log('Intelligent Markdown for Lua deactivated');
  decorationProvider?.dispose();
}
