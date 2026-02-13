# Intelligent Markdown for Lua

基于智能 Markdown 的 Lua 变量双向绑定框架 - VS Code 插件

## 功能特性

### 第一阶段 (MVP) ✅

- ✅ **Lua AST 解析**：准确解析 Lua 文件并定位变量
- ✅ **Markdown 配置块**：支持 `lua-config` 代码块语法
- ✅ **文档链接**：点击配置块中的 key 可跳转到 Lua 源码
- ✅ **悬停提示**：鼠标悬停显示变量当前值和详细信息
- ✅ **内联值显示**：在编辑器中直接显示 Lua 变量的当前值
- ✅ **命令面板**：通过命令查看所有配置绑定

### 第二阶段 (Webview 可视化编辑器) ✅

- ✅ **可视化预览**：Markdown 渲染为美观的文档界面
- ✅ **配置控件**：将 `lua-config` 代码块渲染为可编辑控件
  - 📝 **数字输入框**：带 +/- 按钮，支持 min/max/step
  - 🎚️ **滑动条**：实时拖动调整数值
  - 🔘 **开关按钮**：布尔值快速切换
  - 📋 **下拉选择**：预设选项列表
  - ✏️ **文本输入**：字符串编辑
- ✅ **双向绑定**：修改控件值自动同步到 Lua 文件
- ✅ **跳转源码**：点击定位按钮跳转到 Lua 代码
- ✅ **自动打开预览**：可配置打开 Markdown 时自动显示预览

## 安装

```bash
# 安装依赖
npm install

# 编译
npm run compile

# 开发模式（监听变化）
npm run watch
```

## 使用方法

### 1. 创建配置 Markdown

在 Markdown 文件中使用 `lua-config` 代码块定义 Lua 变量绑定：

````markdown
# 玩家配置

```lua-config
file: ./scripts/player_config.lua
key: PlayerConfig.BaseStats.HP
type: number
min: 100
max: 10000
label: 基础生命值
```
````

### 2. 打开配置预览

- **方式一**：点击编辑器右上角的预览图标 📖
- **方式二**：`Ctrl+Shift+P` → "打开配置预览"
- **方式三**：启用自动预览配置（见下方配置说明）

### 3. 配置块属性

| 属性 | 必填 | 说明 |
|------|------|------|
| `file` | ✅ | Lua 文件相对路径 |
| `key` | ✅ | Lua 变量路径，如 `Config.Stats.HP` |
| `type` | ✅ | 控件类型：`number`, `slider`, `string`, `boolean`, `select` |
| `label` | ❌ | 显示标签 |
| `min/max` | ❌ | 数值范围 |
| `range` | ❌ | slider 类型的范围，格式 `[min, max]` |
| `step` | ❌ | 步进值 |
| `options` | ❌ | select 类型的选项列表 |
| `unit` | ❌ | 单位显示 |

### 4. 插件配置

在 VS Code 设置中搜索 `intelligentMarkdown`：

| 配置项 | 类型 | 默认值 | 说明 |
|-------|------|--------|------|
| `autoSave` | boolean | `true` | 自动保存对 Lua 文件的修改 |
| `showInlineValues` | boolean | `true` | 在编辑器中显示内联值 |
| `autoOpenPreview` | boolean | `false` | 打开 Markdown 时自动显示预览 |
| `autoOpenPreviewPattern` | string | `**/*.config.md` | 自动预览的文件匹配模式 |
| `autoOpenPreviewOnlyWithLuaConfig` | boolean | `true` | 仅当文件包含 lua-config 块时才自动预览 |

#### 推荐配置

```json
{
  "intelligentMarkdown.autoOpenPreview": true,
  "intelligentMarkdown.autoOpenPreviewPattern": "**/*.md",
  "intelligentMarkdown.autoOpenPreviewOnlyWithLuaConfig": true
}
```

## 示例

### Lua 配置文件 (`player_config.lua`)

```lua
PlayerConfig = {
    BaseStats = {
        HP = 1000,      -- 基础生命值
        MP = 500,       -- 基础魔法值
        Attack = 100,   -- 基础攻击力
        MoveSpeed = 200 -- 移动速度
    },
    Settings = {
        ShowTutorial = true,
        Language = "zh-CN",
        Difficulty = "normal"
    }
}
```

### Markdown 配置文档 (`config.md`)

````markdown
# 玩家属性配置

## 基础生命值

```lua-config
file: ./player_config.lua
key: PlayerConfig.BaseStats.HP
type: slider
range: [100, 10000]
step: 100
label: 生命值上限
```

## 移动速度

```lua-config
file: ./player_config.lua
key: PlayerConfig.BaseStats.MoveSpeed
type: number
min: 100
max: 500
step: 10
unit: 单位/秒
label: 基础移动速度
```

## 新手引导

```lua-config
file: ./player_config.lua
key: PlayerConfig.Settings.ShowTutorial
type: boolean
label: 显示新手引导
```

## 游戏难度

```lua-config
file: ./player_config.lua
key: PlayerConfig.Settings.Difficulty
type: select
options:
  - { value: "easy", label: "简单" }
  - { value: "normal", label: "普通" }
  - { value: "hard", label: "困难" }
label: 游戏难度
```
````

## 开发

### 运行测试

```bash
npm test
```

### 调试插件

1. 选择 "Run Extension (Compile First)" 配置
2. 按 `F5` 启动调试
3. 在新窗口中打开包含 `lua-config` 代码块的 Markdown 文件
4. 点击右上角预览按钮或使用命令打开预览

### 调试配置

| 配置名称 | 说明 |
|---------|------|
| Run Extension | 启动 watch 模式（支持热更新） |
| Run Extension (Compile First) | 先编译再启动（推荐） |
| Run Extension (No Build) | 直接启动，不编译 |

## 路线图

- [x] 第一阶段：MVP 原型
- [x] 第二阶段：Webview 可视化编辑器
- [x] 第三阶段：双向绑定（修改即写入）
- [ ] 第四阶段：高级功能（智能补全、类型校验、数组编辑等）

## 技术栈

- TypeScript
- [luaparse](https://github.com/fstirlitz/luaparse) - Lua AST 解析
- VS Code Extension API
- VS Code Webview API

## 项目结构

```
intelligent-markdown/
├── src/
│   ├── extension.ts            # 插件入口
│   ├── core/                   # 核心模块
│   │   ├── parser/             # 解析器（Lua、Markdown）
│   │   ├── linker/             # 链接器（路径解析）
│   │   └── patcher/            # 修补器（值回写）
│   ├── editor/                 # Webview 编辑器
│   ├── providers/              # VS Code 提供者
│   └── types/                  # 类型定义
├── test/                       # 测试文件
│   ├── fixtures/               # 测试用例
│   └── unit/                   # 单元测试
└── docs/                       # 文档
```

## License

MIT
