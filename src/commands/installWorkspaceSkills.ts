import * as vscode from 'vscode';

const CURSOR_SKILL = `---
name: config-md-workflow
description: Guides config.md authoring and maintenance for Lua/JSON/Excel linked workflows. Use when the user edits config.md, wants preview/wizard/probe behavior, or needs consistent config document generation.
---
# config.md Workflow

## Scope
- Use for \`*.config.md\` and markdown docs that contain config blocks, wizard blocks, code blocks, mermaid, and table sections.
- Keep output plain-text first, designer-friendly, and source-of-truth in markdown.

## Core workflow
1. Discover target files
   - Prefer workspace \`*.config.md\` files.
   - If a source file is provided (\`.lua/.json/.jsonc/.xlsx\`), find mapped config markdown first.
2. Edit with structure safety
   - Preserve headings and anchor ids.
   - Keep config block key/path stable unless explicitly requested.
   - Keep wizard step order stable unless explicitly requested.
3. Sync-aware changes
   - For config blocks, ensure new default/value types still match linked source format.
   - For code blocks, keep language tag accurate for syntax highlight and save-back.
   - For tables, keep header semantics and row alignment stable.
4. Verify
   - Re-open preview and check: code highlight, table render, probe links, wizard actions.

## Feature checklist
- Config preview + inline editing
- Lua/JSON/JSONC/Excel linked config blocks
- Wizard prompt generation and execution
- Mermaid rendering with probe navigation
- Code block editing and save-back
- Config manager tree view and focus mode

## Command hints
- \`Open Config Preview\`
- \`Open Config Window Manager\`
- \`Toggle Config Focus Mode\`
- \`Quick Access: config.md\`

## Response style
- Give concise change notes.
- Mention touched files and quick validation steps.
`;

const CODEBUDDY_SKILL = `# config.md 技能卡（CodeBuddy）

## 适用场景
- 用户在维护 \`config.md\` / \`*.config.md\` 规范文档
- 需要联动 Lua/JSON/JSONC/Excel 配置
- 需要处理 wizard、mermaid、代码块、表格渲染与回写

## 目标
- 让 markdown 成为配置与规格的单一入口
- 保持文档可读、可回写、可追踪
- 降低编辑时破坏结构的风险

## 执行流程（精简）
1. 先定位目标 \`config.md\`，再决定是否打开预览。
2. 修改时优先保留块结构（标题、key/path、wizard 步骤顺序）。
3. 涉及源码映射时，保证类型一致（数值/布尔/字符串/数组/对象）。
4. 完成后做可视化检查：代码高亮、表格样式、mermaid 跳转、wizard 可执行。

## 覆盖能力
- Config 预览与交互编辑
- Lua/JSON/JSONC/Excel 配置联动
- Wizard 提示词生成
- Mermaid 探针跳转
- 代码块编辑回写
- Config 管理器与专注模式

## 常用入口
- Open Config Preview
- Open Config Window Manager
- Toggle Config Focus Mode
- Quick Access: config.md

## 输出要求
- 先给变更结论，再给验证步骤
- 路径清晰、描述简洁、避免冗余解释
`;

export async function installWorkspaceSkillsCommand(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders || [];
  if (workspaceFolders.length === 0) {
    vscode.window.showWarningMessage(vscode.l10n.t('Open a workspace folder first'));
    return;
  }

  let targetFolder = workspaceFolders[0];
  if (workspaceFolders.length > 1) {
    const picked = await vscode.window.showQuickPick(
      workspaceFolders.map(folder => ({
        label: folder.name,
        description: folder.uri.fsPath,
        folder
      })),
      {
        title: vscode.l10n.t('Select workspace for skill installation'),
        placeHolder: vscode.l10n.t('Choose a workspace folder')
      }
    );
    if (!picked) {
      return;
    }
    targetFolder = picked.folder;
  }

  const cursorSkillDir = vscode.Uri.joinPath(
    targetFolder.uri,
    '.cursor',
    'skills',
    'config-md-workflow'
  );
  const codeBuddySkillDir = vscode.Uri.joinPath(
    targetFolder.uri,
    '.codebuddy',
    'skills',
    'config-md-workflow'
  );

  const cursorSkillFile = vscode.Uri.joinPath(cursorSkillDir, 'SKILL.md');
  const codeBuddySkillFile = vscode.Uri.joinPath(codeBuddySkillDir, 'SKILL.md');

  await vscode.workspace.fs.createDirectory(cursorSkillDir);
  await vscode.workspace.fs.createDirectory(codeBuddySkillDir);
  await vscode.workspace.fs.writeFile(cursorSkillFile, Buffer.from(CURSOR_SKILL, 'utf8'));
  await vscode.workspace.fs.writeFile(codeBuddySkillFile, Buffer.from(CODEBUDDY_SKILL, 'utf8'));

  const openCursor = vscode.l10n.t('Open Cursor Skill');
  const openCodeBuddy = vscode.l10n.t('Open CodeBuddy Skill');
  const choice = await vscode.window.showInformationMessage(
    vscode.l10n.t(
      'config.md skills installed to {0}',
      targetFolder.uri.fsPath
    ),
    openCursor,
    openCodeBuddy
  );

  if (choice === openCursor) {
    const doc = await vscode.workspace.openTextDocument(cursorSkillFile);
    await vscode.window.showTextDocument(doc, { preview: false });
  } else if (choice === openCodeBuddy) {
    const doc = await vscode.workspace.openTextDocument(codeBuddySkillFile);
    await vscode.window.showTextDocument(doc, { preview: false });
  }
}
