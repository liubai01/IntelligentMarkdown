# 智能 Markdown Lua 变量双向绑定框架

## 项目概述

本项目是一个 VS Code 插件，旨在为游戏策划提供一个基于 Markdown 的可视化配置编辑器。通过在 Markdown 文档中定义特殊的链接语法，策划可以直接在文档中修改 Lua 配置文件中的变量值，实现**所见即所得**的配置体验。

### 核心价值

- **降低门槛**：策划无需理解 Lua 语法，只需在熟悉的 Markdown 文档中操作
- **保持灵活性**：程序员仍可直接编辑 Lua 代码，保持代码结构不变
- **双向同步**：Markdown 和 Lua 文件实时双向同步，任一方修改都能反映到另一方

---

## 一、总体架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                    表现层 (Presentation Layer)                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Smart Markdown Editor (Webview)               │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐  │  │
│  │  │ Input   │  │ Slider  │  │ Select  │  │ Color Picker│  │  │
│  │  │ 输入框   │  │ 滑动条   │  │ 下拉框   │  │ 颜色选择器  │  │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ postMessage
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  逻辑层 (Extension Host Layer)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Linker    │  │   Watcher   │  │  CustomEditorProvider   │  │
│  │  链接解析器  │  │  文件监听器  │  │     自定义编辑器提供者    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     数据层 (AST Layer)                           │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐   │
│  │     Lua Parser      │  │       Patch Generator           │   │
│  │   (luaparse AST)    │  │    (magic-string 精准替换)       │   │
│  └─────────────────────┘  └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、项目目录结构

```
intelligent-markdown/
├── package.json                 # 插件配置文件
├── tsconfig.json               # TypeScript 配置
├── webpack.config.js           # Webpack 打包配置
│
├── src/
│   ├── extension.ts            # 插件入口
│   │
│   ├── core/                   # 核心模块
│   │   ├── parser/
│   │   │   ├── markdownParser.ts    # Markdown 解析器
│   │   │   ├── luaParser.ts         # Lua AST 解析器
│   │   │   └── configBlockParser.ts # 配置块解析器
│   │   │
│   │   ├── linker/
│   │   │   ├── luaLinker.ts         # Lua 文件链接器
│   │   │   └── pathResolver.ts      # 路径解析器
│   │   │
│   │   ├── patcher/
│   │   │   ├── luaPatcher.ts        # Lua 文件修补器
│   │   │   └── astNavigator.ts      # AST 导航器
│   │   │
│   │   └── watcher/
│   │       └── fileWatcher.ts       # 文件变化监听器
│   │
│   ├── editor/                 # 编辑器模块
│   │   ├── smartMarkdownEditor.ts   # 自定义编辑器提供者
│   │   ├── documentManager.ts       # 文档管理器
│   │   └── messageHandler.ts        # 消息处理器
│   │
│   ├── providers/              # VS Code 提供者
│   │   ├── completionProvider.ts    # 自动补全
│   │   ├── hoverProvider.ts         # 悬停提示
│   │   └── documentLinkProvider.ts  # 文档链接
│   │
│   ├── types/                  # 类型定义
│   │   ├── configBlock.ts           # 配置块类型
│   │   ├── luaNode.ts               # Lua AST 节点类型
│   │   └── message.ts               # 消息类型
│   │
│   └── utils/                  # 工具函数
│       ├── luaValueConverter.ts     # Lua 值转换器
│       └── validator.ts             # 数据验证器
│
├── webview/                    # Webview 前端代码
│   ├── src/
│   │   ├── App.tsx                  # React 主组件
│   │   ├── index.tsx                # 入口文件
│   │   │
│   │   ├── components/
│   │   │   ├── MarkdownRenderer.tsx # Markdown 渲染器
│   │   │   ├── ConfigBlock.tsx      # 配置块组件
│   │   │   ├── NumberInput.tsx      # 数字输入组件
│   │   │   ├── SliderInput.tsx      # 滑动条组件
│   │   │   ├── SelectInput.tsx      # 下拉选择组件
│   │   │   ├── StringInput.tsx      # 字符串输入组件
│   │   │   ├── BooleanInput.tsx     # 布尔值开关组件
│   │   │   └── TableEditor.tsx      # 表格编辑组件
│   │   │
│   │   ├── hooks/
│   │   │   ├── useVSCodeAPI.ts      # VS Code API Hook
│   │   │   └── useConfigValue.ts    # 配置值 Hook
│   │   │
│   │   └── styles/
│   │       └── editor.css           # 样式文件
│   │
│   └── webpack.config.js       # Webview 打包配置
│
├── test/                       # 测试文件
│   ├── unit/
│   │   ├── luaParser.test.ts
│   │   ├── luaPatcher.test.ts
│   │   └── markdownParser.test.ts
│   │
│   └── fixtures/               # 测试用例文件
│       ├── sample.lua
│       └── sample.md
│
└── docs/                       # 文档
    ├── ARCHITECTURE.md         # 架构文档（本文件）
    ├── SYNTAX.md               # 语法说明
    └── DEVELOPMENT.md          # 开发指南
```

---

## 三、核心模块设计

### 3.1 智能 Markdown 语法定义 (Protocol)

使用 Markdown 的 Fenced Code Block 语法，定义 `lua-config` 语言标记：

````markdown
# 玩家基础数值配置

这里配置玩家出生时的基础属性。

### 基础生命值
> 策划备注：初始生命值不要超过 10000，否则会影响游戏平衡。

```lua-config
file: ./scripts/player_config.lua
key: PlayerConfig.BaseStats.HP
type: number
default: 100
min: 1
max: 10000
step: 10
label: 生命值上限
```

### 移动速度

```lua-config
file: ./scripts/player_config.lua
key: PlayerConfig.BaseStats.MoveSpeed
type: slider
default: 200
range: [100, 500]
step: 10
label: 基础移动速度
unit: 单位/秒
```

### 角色职业

```lua-config
file: ./scripts/player_config.lua
key: PlayerConfig.Class
type: select
options:
  - { value: "warrior", label: "战士" }
  - { value: "mage", label: "法师" }
  - { value: "archer", label: "弓箭手" }
label: 默认职业
```

### 是否启用新手引导

```lua-config
file: ./scripts/game_settings.lua
key: GameSettings.Tutorial.Enabled
type: boolean
label: 新手引导开关
```
````

#### 配置块属性说明

| 属性 | 必填 | 说明 |
|------|------|------|
| `file` | ✅ | Lua 文件相对路径（相对于 Markdown 文件） |
| `key` | ✅ | Lua 变量路径，使用点号分隔嵌套层级 |
| `type` | ✅ | 控件类型：`number`, `slider`, `string`, `boolean`, `select`, `color`, `array` |
| `label` | ❌ | 显示标签，默认使用 key 的最后一段 |
| `default` | ❌ | 默认值 |
| `min/max` | ❌ | 数值范围限制 |
| `range` | ❌ | slider 专用，等同于 [min, max] |
| `step` | ❌ | 数值步进 |
| `options` | ❌ | select 专用，选项列表 |
| `unit` | ❌ | 单位显示 |
| `readonly` | ❌ | 是否只读 |

---

### 3.2 Lua AST 解析与回写引擎

#### 3.2.1 AST 解析流程

```typescript
// src/core/parser/luaParser.ts

import * as luaparse from 'luaparse';

export interface LuaValueNode {
  type: 'number' | 'string' | 'boolean' | 'table' | 'nil';
  value: any;
  range: [number, number];  // 源码中的字符位置
  loc: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

export class LuaParser {
  private ast: luaparse.Chunk;
  private sourceCode: string;

  constructor(sourceCode: string) {
    this.sourceCode = sourceCode;
    this.ast = luaparse.parse(sourceCode, {
      ranges: true,      // 启用范围记录
      locations: true,   // 启用位置记录
      comments: true,    // 保留注释信息
      luaVersion: '5.3'
    });
  }

  /**
   * 根据路径查找 Lua 变量节点
   * @param keyPath 变量路径，如 "PlayerConfig.BaseStats.HP"
   */
  findNodeByPath(keyPath: string): LuaValueNode | null {
    const keys = keyPath.split('.');
    let currentNode: any = this.findRootAssignment(keys[0]);
    
    if (!currentNode) return null;

    for (let i = 1; i < keys.length; i++) {
      currentNode = this.findTableField(currentNode, keys[i]);
      if (!currentNode) return null;
    }

    return this.extractValueNode(currentNode);
  }

  /**
   * 查找根级赋值语句
   */
  private findRootAssignment(name: string): any {
    for (const statement of this.ast.body) {
      if (statement.type === 'AssignmentStatement' ||
          statement.type === 'LocalStatement') {
        // 查找匹配的变量名
        // ... 实现细节
      }
    }
    return null;
  }

  /**
   * 在 Table 中查找指定字段
   */
  private findTableField(tableNode: any, fieldName: string): any {
    if (tableNode.type !== 'TableConstructorExpression') return null;
    
    for (const field of tableNode.fields) {
      if (field.type === 'TableKeyString' && 
          field.key.name === fieldName) {
        return field.value;
      }
    }
    return null;
  }
}
```

#### 3.2.2 精准回写策略

```typescript
// src/core/patcher/luaPatcher.ts

import MagicString from 'magic-string';

export class LuaPatcher {
  private magicString: MagicString;
  private sourceCode: string;

  constructor(sourceCode: string) {
    this.sourceCode = sourceCode;
    this.magicString = new MagicString(sourceCode);
  }

  /**
   * 更新指定位置的值
   * 核心原则：只替换值的部分，保留所有注释和格式
   */
  updateValue(range: [number, number], newValue: any, valueType: string): string {
    const formattedValue = this.formatLuaValue(newValue, valueType);
    
    // 使用 magic-string 精准替换
    this.magicString.overwrite(range[0], range[1], formattedValue);
    
    return this.magicString.toString();
  }

  /**
   * 将 JavaScript 值转换为 Lua 格式
   */
  private formatLuaValue(value: any, type: string): string {
    switch (type) {
      case 'number':
        return String(value);
      case 'string':
        // 转义特殊字符
        return `"${this.escapeLuaString(value)}"`;
      case 'boolean':
        return value ? 'true' : 'false';
      case 'nil':
        return 'nil';
      default:
        return String(value);
    }
  }

  /**
   * 转义 Lua 字符串中的特殊字符
   */
  private escapeLuaString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }
}
```

---

### 3.3 VS Code 自定义编辑器

#### 3.3.1 编辑器注册 (package.json)

```json
{
  "name": "intelligent-markdown",
  "displayName": "Intelligent Markdown for Lua",
  "version": "0.1.0",
  "engines": {
    "vscode": "^1.74.0"
  },
  "categories": ["Other"],
  "activationEvents": [
    "onCustomEditor:intelligentMarkdown.luaConfig"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "customEditors": [
      {
        "viewType": "intelligentMarkdown.luaConfig",
        "displayName": "Smart Markdown Editor",
        "selector": [
          {
            "filenamePattern": "*.lua.md"
          },
          {
            "filenamePattern": "*.config.md"
          }
        ],
        "priority": "default"
      }
    ],
    "commands": [
      {
        "command": "intelligentMarkdown.openPreview",
        "title": "Open Smart Preview",
        "category": "Intelligent Markdown"
      },
      {
        "command": "intelligentMarkdown.refreshBindings",
        "title": "Refresh Lua Bindings",
        "category": "Intelligent Markdown"
      }
    ],
    "configuration": {
      "title": "Intelligent Markdown",
      "properties": {
        "intelligentMarkdown.autoSave": {
          "type": "boolean",
          "default": true,
          "description": "自动保存对 Lua 文件的修改"
        },
        "intelligentMarkdown.showInlineValues": {
          "type": "boolean",
          "default": true,
          "description": "在普通编辑器中显示内联值"
        }
      }
    }
  }
}
```

#### 3.3.2 自定义编辑器提供者

```typescript
// src/editor/smartMarkdownEditor.ts

import * as vscode from 'vscode';
import { MarkdownParser } from '../core/parser/markdownParser';
import { LuaParser } from '../core/parser/luaParser';
import { LuaPatcher } from '../core/patcher/luaPatcher';

export class SmartMarkdownEditorProvider implements vscode.CustomTextEditorProvider {
  
  public static readonly viewType = 'intelligentMarkdown.luaConfig';

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    
    // 配置 Webview
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'webview', 'dist')
      ]
    };

    // 设置 HTML 内容
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    // 初始化数据
    await this.updateWebview(document, webviewPanel.webview);

    // 监听 Webview 消息
    webviewPanel.webview.onDidReceiveMessage(
      message => this.handleWebviewMessage(message, document),
      undefined,
      this.context.subscriptions
    );

    // 监听文档变化
    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.uri.toString() === document.uri.toString()) {
        this.updateWebview(document, webviewPanel.webview);
      }
    });

    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
    });
  }

  /**
   * 处理来自 Webview 的消息
   */
  private async handleWebviewMessage(
    message: any, 
    document: vscode.TextDocument
  ): Promise<void> {
    switch (message.type) {
      case 'updateValue':
        await this.updateLuaValue(
          document,
          message.filePath,
          message.keyPath,
          message.newValue,
          message.valueType
        );
        break;
      case 'requestRefresh':
        // 重新读取所有绑定值
        break;
    }
  }

  /**
   * 更新 Lua 文件中的值
   */
  private async updateLuaValue(
    mdDocument: vscode.TextDocument,
    relativeFilePath: string,
    keyPath: string,
    newValue: any,
    valueType: string
  ): Promise<void> {
    // 解析绝对路径
    const mdDir = vscode.Uri.joinPath(mdDocument.uri, '..');
    const luaUri = vscode.Uri.joinPath(mdDir, relativeFilePath);

    // 读取 Lua 文件
    const luaDocument = await vscode.workspace.openTextDocument(luaUri);
    const luaCode = luaDocument.getText();

    // 解析并定位
    const parser = new LuaParser(luaCode);
    const node = parser.findNodeByPath(keyPath);

    if (!node) {
      vscode.window.showErrorMessage(`无法找到变量: ${keyPath}`);
      return;
    }

    // 生成新代码
    const patcher = new LuaPatcher(luaCode);
    const newCode = patcher.updateValue(node.range, newValue, valueType);

    // 写入文件
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      luaUri,
      new vscode.Range(0, 0, luaDocument.lineCount, 0),
      newCode
    );
    await vscode.workspace.applyEdit(edit);
    await luaDocument.save();
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    // 返回 Webview HTML
    return `<!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Smart Markdown Editor</title>
      </head>
      <body>
        <div id="root"></div>
        <script src="${webview.asWebviewUri(...)}"></script>
      </body>
      </html>`;
  }
}
```

---

### 3.4 Webview 前端组件

#### 3.4.1 配置块组件

```tsx
// webview/src/components/ConfigBlock.tsx

import React, { useState, useEffect } from 'react';
import { NumberInput } from './NumberInput';
import { SliderInput } from './SliderInput';
import { SelectInput } from './SelectInput';
import { BooleanInput } from './BooleanInput';
import { StringInput } from './StringInput';

interface ConfigBlockProps {
  config: {
    file: string;
    key: string;
    type: 'number' | 'slider' | 'string' | 'boolean' | 'select';
    label?: string;
    min?: number;
    max?: number;
    step?: number;
    options?: Array<{ value: string; label: string }>;
    unit?: string;
    readonly?: boolean;
  };
  value: any;
  onUpdate: (newValue: any) => void;
}

export const ConfigBlock: React.FC<ConfigBlockProps> = ({ 
  config, 
  value, 
  onUpdate 
}) => {
  const [localValue, setLocalValue] = useState(value);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setLocalValue(value);
    setIsDirty(false);
  }, [value]);

  const handleChange = (newValue: any) => {
    setLocalValue(newValue);
    setIsDirty(true);
  };

  const handleBlur = () => {
    if (isDirty) {
      onUpdate(localValue);
      setIsDirty(false);
    }
  };

  const renderInput = () => {
    switch (config.type) {
      case 'number':
        return (
          <NumberInput
            value={localValue}
            min={config.min}
            max={config.max}
            step={config.step}
            unit={config.unit}
            disabled={config.readonly}
            onChange={handleChange}
            onBlur={handleBlur}
          />
        );
      case 'slider':
        return (
          <SliderInput
            value={localValue}
            min={config.min ?? 0}
            max={config.max ?? 100}
            step={config.step}
            unit={config.unit}
            disabled={config.readonly}
            onChange={handleChange}
            onChangeComplete={handleBlur}
          />
        );
      case 'boolean':
        return (
          <BooleanInput
            value={localValue}
            disabled={config.readonly}
            onChange={(v) => {
              handleChange(v);
              onUpdate(v);  // 布尔值立即提交
            }}
          />
        );
      case 'select':
        return (
          <SelectInput
            value={localValue}
            options={config.options ?? []}
            disabled={config.readonly}
            onChange={(v) => {
              handleChange(v);
              onUpdate(v);  // 选择后立即提交
            }}
          />
        );
      case 'string':
      default:
        return (
          <StringInput
            value={localValue}
            disabled={config.readonly}
            onChange={handleChange}
            onBlur={handleBlur}
          />
        );
    }
  };

  return (
    <div className={`config-block ${isDirty ? 'dirty' : ''}`}>
      <div className="config-header">
        <span className="config-label">
          {config.label || config.key.split('.').pop()}
        </span>
        <span className="config-key" title={config.key}>
          {config.key}
        </span>
      </div>
      <div className="config-input">
        {renderInput()}
      </div>
      {isDirty && <span className="dirty-indicator">未保存</span>}
    </div>
  );
};
```

---

## 四、数据流与交互流程

### 4.1 初始化流程

```
┌──────────────┐     ┌───────────────┐     ┌─────────────┐     ┌──────────────┐
│  策划打开     │     │  Extension    │     │  Lua Files  │     │   Webview    │
│  config.md   │────▶│  解析 MD 文件  │────▶│  读取 & AST │────▶│  渲染 UI     │
└──────────────┘     └───────────────┘     └─────────────┘     └──────────────┘
                            │                      │
                            │   提取配置块定义      │   获取当前值
                            ▼                      ▼
                     ┌─────────────────────────────────────┐
                     │  configBlocks: [                    │
                     │    { file, key, type, value: 100 }  │
                     │    { file, key, type, value: 200 }  │
                     │  ]                                   │
                     └─────────────────────────────────────┘
```

### 4.2 值修改流程

```
┌──────────────┐                          ┌───────────────┐
│  策划修改    │    postMessage           │   Extension   │
│  HP: 100→200 │  ────────────────────▶   │   Host        │
└──────────────┘                          └───────┬───────┘
                                                  │
        ┌─────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────┐
│  1. 读取 player_config.lua                                │
│  2. AST 解析，定位 PlayerConfig.BaseStats.HP              │
│  3. 获取 range: [156, 159]                               │
│  4. 替换: code.slice(0,156) + "200" + code.slice(159)    │
│  5. 写入文件                                              │
└───────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────┐
│ Lua 文件已   │
│ 更新完成     │
└──────────────┘
```

### 4.3 反向同步流程（Lua → Markdown）

```
┌───────────────┐     ┌──────────────────┐     ┌─────────────┐
│  程序员修改   │     │  FileWatcher     │     │  Webview    │
│  Lua 文件     │────▶│  检测到变化       │────▶│  更新显示   │
└───────────────┘     └──────────────────┘     └─────────────┘
                              │
                              │ 重新解析 AST
                              │ 提取新值
                              │ postMessage
                              ▼
                       ┌─────────────┐
                       │ HP: 200→300 │
                       │ (自动刷新)   │
                       └─────────────┘
```

---

## 五、开发路线图

### 第一阶段：MVP 原型（2 周）

**目标**：验证核心可行性

| 任务 | 说明 | 技术点 |
|------|------|--------|
| ✅ 项目搭建 | 初始化 VS Code 插件项目 | Yeoman generator |
| ✅ Lua 解析器 | 实现 AST 解析和路径定位 | luaparse |
| ✅ 简单 UI | 命令面板显示变量值 | vscode.QuickPick |
| ✅ 文档链接 | 点击跳转到 Lua 源码 | DocumentLinkProvider |

**交付物**：
- 可以解析 `lua-config` 代码块
- 可以读取对应 Lua 变量的值
- 可以跳转到 Lua 文件的对应行

### 第二阶段：Webview 编辑器（3 周）

**目标**：实现可视化预览

| 任务 | 说明 | 技术点 |
|------|------|--------|
| ⬜ Webview 基础 | 搭建 React Webview 环境 | React, Webpack |
| ⬜ Markdown 渲染 | 渲染普通 Markdown 内容 | markdown-it |
| ⬜ 配置块替换 | 将配置块渲染为 UI 组件 | markdown-it 插件 |
| ⬜ 数据展示 | 显示 Lua 中的当前值 | postMessage |

**交付物**：
- 完整的 Webview 编辑器
- 支持 number, string, boolean 三种类型的显示

### 第三阶段：双向绑定（2 周）

**目标**：实现完整的读写功能

| 任务 | 说明 | 技术点 |
|------|------|--------|
| ⬜ 值写入 | 修改 UI 后写入 Lua 文件 | magic-string |
| ⬜ 文件监听 | Lua 变化时更新 UI | FileSystemWatcher |
| ⬜ 错误处理 | 处理各种异常情况 | 错误边界 |
| ⬜ 保存模式 | 自动保存 / 手动保存 | 配置项 |

**交付物**：
- 完整的双向绑定功能
- 可靠的错误处理机制

### 第四阶段：高级功能（持续迭代）

| 功能 | 优先级 | 说明 |
|------|--------|------|
| ⬜ Slider 组件 | 高 | 滑动条输入 |
| ⬜ Select 组件 | 高 | 下拉选择 |
| ⬜ 类型校验 | 高 | 输入合法性检查 |
| ⬜ 智能补全 | 中 | Lua 变量路径补全 |
| ⬜ 数组编辑 | 中 | 支持 Lua 数组类型 |
| ⬜ Table 预览 | 低 | 复杂 Table 的树形展示 |
| ⬜ 颜色选择器 | 低 | 支持颜色类型 |
| ⬜ 批量操作 | 低 | 多文件批量修改 |

---

## 六、技术栈总结

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| **Extension** | TypeScript | VS Code 插件开发语言 |
| **AST 解析** | luaparse | Lua 5.1/5.2/5.3 语法支持 |
| **文本操作** | magic-string | 精准替换，保留 sourcemap |
| **Webview** | React 18 | 组件化 UI 开发 |
| **Markdown** | markdown-it | 可扩展的 Markdown 解析器 |
| **构建工具** | Webpack 5 | 打包 Extension 和 Webview |
| **样式** | CSS Modules | 局部样式，避免冲突 |
| **测试** | Vitest | 快速的单元测试框架 |

---

## 七、关键难点与解决方案

### 难点 1：复杂的 Lua Table 嵌套定位

**问题**：Lua 的 Table 可以任意嵌套，如何准确定位 `Config.Items[1].Name`？

**解决方案**：

```typescript
// 路径解析器
class PathResolver {
  // 支持的路径格式:
  // - Config.BaseStats.HP          (普通嵌套)
  // - Config.Items[1].Name          (数组索引)
  // - Config["special-key"].Value   (字符串键)
  
  parse(path: string): PathSegment[] {
    const segments: PathSegment[] = [];
    const regex = /(\w+)|\[(\d+)\]|\["([^"]+)"\]/g;
    
    let match;
    while ((match = regex.exec(path)) !== null) {
      if (match[1]) {
        segments.push({ type: 'key', value: match[1] });
      } else if (match[2]) {
        segments.push({ type: 'index', value: parseInt(match[2]) });
      } else if (match[3]) {
        segments.push({ type: 'string-key', value: match[3] });
      }
    }
    
    return segments;
  }
}
```

### 难点 2：保持 Lua 文件格式和注释

**问题**：直接重新生成 Lua 代码会丢失注释和格式。

**解决方案**：

```typescript
// 只替换值的部分，不重新生成整个文件
const originalCode = `
-- 玩家配置
PlayerConfig = {
    HP = 100,  -- 生命值
    MP = 50,   -- 魔法值
}
`;

// 假设 HP 的值 "100" 在位置 [45, 48]
const newCode = 
    originalCode.slice(0, 45) + 
    '200' + 
    originalCode.slice(48);

// 结果：注释完整保留
// -- 玩家配置
// PlayerConfig = {
//     HP = 200,  -- 生命值
//     MP = 50,   -- 魔法值
// }
```

### 难点 3：多人协作时的冲突处理

**问题**：策划 A 修改 Markdown，策划 B 修改 Lua，可能产生冲突。

**解决方案**：

1. **写入前重新读取**：每次写入 Lua 前，重新读取文件内容，基于最新内容计算 patch
2. **乐观锁机制**：记录上次读取时的文件 hash，写入时校验
3. **依赖 Git**：文件级冲突由 Git 处理，插件只保证单次操作的原子性

```typescript
async function safeUpdateLuaFile(filePath: string, keyPath: string, newValue: any) {
  // 1. 重新读取最新内容
  const latestCode = await fs.readFile(filePath, 'utf-8');
  
  // 2. 基于最新内容解析
  const parser = new LuaParser(latestCode);
  const node = parser.findNodeByPath(keyPath);
  
  // 3. 应用修改
  const patcher = new LuaPatcher(latestCode);
  const newCode = patcher.updateValue(node.range, newValue);
  
  // 4. 原子写入
  await fs.writeFile(filePath, newCode, 'utf-8');
}
```

### 难点 4：类型安全与输入校验

**问题**：策划输入了非法值（如在数字字段输入字符串）。

**解决方案**：

```typescript
// 前端校验层
const validators = {
  number: (value: string, config: ConfigBlock) => {
    const num = parseFloat(value);
    if (isNaN(num)) return { valid: false, error: '请输入数字' };
    if (config.min !== undefined && num < config.min) {
      return { valid: false, error: `最小值为 ${config.min}` };
    }
    if (config.max !== undefined && num > config.max) {
      return { valid: false, error: `最大值为 ${config.max}` };
    }
    return { valid: true, value: num };
  },
  
  string: (value: string) => {
    return { valid: true, value };
  },
  
  boolean: (value: any) => {
    return { valid: true, value: Boolean(value) };
  }
};
```

---

## 八、示例场景

### 场景：策划配置玩家属性

**Markdown 文件**：`docs/player_config.md`

````markdown
# 玩家属性配置文档

本文档用于配置玩家的基础属性，修改后会自动同步到 Lua 代码。

## 基础属性

### 生命值

```lua-config
file: ../scripts/player/config.lua
key: PlayerConfig.BaseStats.HP
type: number
min: 100
max: 10000
step: 100
label: 基础生命值
```

### 攻击力

```lua-config
file: ../scripts/player/config.lua
key: PlayerConfig.BaseStats.Attack
type: slider
range: [10, 500]
step: 5
label: 基础攻击力
```

## 技能配置

### 默认技能 ID

```lua-config
file: ../scripts/player/config.lua
key: PlayerConfig.Skills.DefaultSkillId
type: select
options:
  - { value: 1001, label: "普通攻击" }
  - { value: 1002, label: "重击" }
  - { value: 1003, label: "旋风斩" }
label: 出生默认技能
```
````

**对应的 Lua 文件**：`scripts/player/config.lua`

```lua
-- 玩家配置表
-- 作者：游戏程序组
-- 最后修改：2024-01-15

PlayerConfig = {
    -- 基础属性
    BaseStats = {
        HP = 1000,      -- 基础生命值
        Attack = 100,   -- 基础攻击力
        Defense = 50,   -- 基础防御力
    },
    
    -- 技能配置
    Skills = {
        DefaultSkillId = 1001,  -- 默认技能
        MaxSkillSlots = 4,      -- 最大技能槽位
    },
}

return PlayerConfig
```

**Webview 渲染效果**：

```
┌─────────────────────────────────────────────────────────────┐
│  # 玩家属性配置文档                                          │
│                                                             │
│  本文档用于配置玩家的基础属性，修改后会自动同步到 Lua 代码。     │
│                                                             │
│  ## 基础属性                                                │
│                                                             │
│  ### 生命值                                                 │
│  ┌─────────────────────────────────────────┐               │
│  │ 基础生命值                    ┌────────┐ │               │
│  │ PlayerConfig.BaseStats.HP    │  1000  │ │               │
│  │                              └────────┘ │               │
│  │ 范围: 100 ~ 10000                       │               │
│  └─────────────────────────────────────────┘               │
│                                                             │
│  ### 攻击力                                                 │
│  ┌─────────────────────────────────────────┐               │
│  │ 基础攻击力                               │               │
│  │ ────●─────────────────────── 100        │               │
│  │ 10                            500       │               │
│  └─────────────────────────────────────────┘               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 九、后续扩展方向

1. **多语言支持**：扩展到 JSON、YAML、TOML 等配置格式
2. **团队协作**：集成 Git 变更追踪，显示"谁最后修改了这个值"
3. **版本对比**：可视化对比不同版本的配置差异
4. **模板系统**：预设常用的配置模板，一键生成 Markdown
5. **权限控制**：某些关键配置设为只读，防止误改
6. **导出功能**：将 Markdown 导出为 PDF/HTML 文档

---

## 十、参考资源

- [VS Code Custom Editor API](https://code.visualstudio.com/api/extension-guides/custom-editors)
- [luaparse - Lua Parser for JavaScript](https://github.com/fstirlitz/luaparse)
- [magic-string - String Manipulation Library](https://github.com/Rich-Harris/magic-string)
- [markdown-it - Markdown Parser](https://github.com/markdown-it/markdown-it)
- [VS Code Webview API](https://code.visualstudio.com/api/extension-guides/webview)

---

*文档版本：v1.0*
*最后更新：2024-01*
