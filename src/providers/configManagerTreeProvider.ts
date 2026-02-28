import * as vscode from 'vscode';

type NodeType = 'workspace' | 'folder' | 'file';

interface ConfigTreeNode {
  type: NodeType;
  label: string;
  key: string;
  folderUri?: vscode.Uri;
  fileUri?: vscode.Uri;
  children?: ConfigTreeNode[];
}

export class ConfigManagerTreeProvider implements vscode.TreeDataProvider<ConfigTreeNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<ConfigTreeNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private roots: ConfigTreeNode[] = [];

  constructor(private readonly extensionContext: vscode.ExtensionContext) {
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.config.md');
    watcher.onDidCreate(() => { void this.refresh(); });
    watcher.onDidDelete(() => { void this.refresh(); });
    watcher.onDidChange(() => { void this.refresh(); });
    this.extensionContext.subscriptions.push(watcher);
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.roots = await this.buildTree();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ConfigTreeNode): vscode.TreeItem {
    if (element.type === 'workspace') {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Expanded);
      item.contextValue = 'configWorkspace';
      item.iconPath = new vscode.ThemeIcon('root-folder');
      return item;
    }

    if (element.type === 'folder') {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Collapsed);
      item.contextValue = 'configFolder';
      item.iconPath = vscode.ThemeIcon.Folder;
      return item;
    }

    const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
    item.contextValue = 'configFile';
    item.iconPath = new vscode.ThemeIcon('markdown');
    item.resourceUri = element.fileUri;
    item.command = {
      command: 'intelligentMarkdown.configManager.openPreview',
      title: 'Open Config Preview',
      arguments: [element.fileUri]
    };
    return item;
  }

  getChildren(element?: ConfigTreeNode): Thenable<ConfigTreeNode[]> {
    if (!element) {
      return Promise.resolve(this.roots);
    }
    return Promise.resolve(element.children || []);
  }

  private async buildTree(): Promise<ConfigTreeNode[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders || [];
    if (workspaceFolders.length === 0) {
      return [];
    }

    const configFiles = await vscode.workspace.findFiles(
      '**/*.config.md',
      '**/{node_modules,.git,dist,out}/**'
    );

    const filesByWorkspace = new Map<string, vscode.Uri[]>();
    for (const ws of workspaceFolders) {
      filesByWorkspace.set(ws.uri.toString(), []);
    }

    for (const fileUri of configFiles) {
      const ws = vscode.workspace.getWorkspaceFolder(fileUri);
      if (!ws) {
        continue;
      }
      const bucket = filesByWorkspace.get(ws.uri.toString());
      if (bucket) {
        bucket.push(fileUri);
      }
    }

    const showWorkspaceRoot = workspaceFolders.length > 1;
    const roots: ConfigTreeNode[] = [];

    for (const ws of workspaceFolders) {
      const files = filesByWorkspace.get(ws.uri.toString()) || [];
      if (files.length === 0) {
        continue;
      }
      const folderNodes = this.buildFolderNodes(ws.uri, files);
      if (folderNodes.length === 0) {
        continue;
      }
      if (showWorkspaceRoot) {
        roots.push({
          type: 'workspace',
          label: ws.name,
          key: `workspace:${ws.uri.toString()}`,
          folderUri: ws.uri,
          children: folderNodes
        });
      } else {
        roots.push(...folderNodes);
      }
    }

    return roots;
  }

  private buildFolderNodes(workspaceUri: vscode.Uri, files: vscode.Uri[]): ConfigTreeNode[] {
    const root: ConfigTreeNode = {
      type: 'folder',
      label: '',
      key: `root:${workspaceUri.toString()}`,
      folderUri: workspaceUri,
      children: []
    };

    const folderMap = new Map<string, ConfigTreeNode>();
    folderMap.set('', root);

    for (const fileUri of files) {
      const relPath = vscode.workspace.asRelativePath(fileUri, false).replace(/\\/g, '/');
      const relToWorkspace = this.relativeToWorkspace(relPath, workspaceUri);
      const segments = relToWorkspace.split('/').filter(Boolean);
      if (segments.length === 0) {
        continue;
      }

      const fileName = segments[segments.length - 1];
      const folders = segments.slice(0, -1);
      let currentPath = '';
      let parent = root;

      for (const folder of folders) {
        currentPath = currentPath ? `${currentPath}/${folder}` : folder;
        let existing = folderMap.get(currentPath);
        if (!existing) {
          existing = {
            type: 'folder',
            label: folder,
            key: `folder:${workspaceUri.toString()}:${currentPath}`,
            children: []
          };
          parent.children?.push(existing);
          folderMap.set(currentPath, existing);
        }
        parent = existing;
      }

      parent.children?.push({
        type: 'file',
        label: fileName,
        key: `file:${fileUri.toString()}`,
        fileUri
      });
    }

    this.sortNodeChildren(root);
    const pruned = this.pruneEmptyFolders(root.children || []);
    return pruned;
  }

  private relativeToWorkspace(relativePath: string, workspaceUri: vscode.Uri): string {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(workspaceUri);
    if (!workspaceFolder) {
      return relativePath;
    }
    const prefix = `${workspaceFolder.name}/`;
    return relativePath.startsWith(prefix) ? relativePath.slice(prefix.length) : relativePath;
  }

  private sortNodeChildren(node: ConfigTreeNode): void {
    if (!node.children || node.children.length === 0) {
      return;
    }

    node.children.sort((a, b) => {
      const typeRank = (n: ConfigTreeNode) => (n.type === 'file' ? 1 : 0);
      const rankDiff = typeRank(a) - typeRank(b);
      if (rankDiff !== 0) {
        return rankDiff;
      }
      return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
    });

    for (const child of node.children) {
      this.sortNodeChildren(child);
    }
  }

  private pruneEmptyFolders(nodes: ConfigTreeNode[]): ConfigTreeNode[] {
    const result: ConfigTreeNode[] = [];
    for (const node of nodes) {
      if (node.type === 'file') {
        result.push(node);
        continue;
      }
      const children = this.pruneEmptyFolders(node.children || []);
      if (children.length > 0) {
        node.children = children;
        result.push(node);
      }
    }
    return result;
  }

}
