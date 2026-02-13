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

### 2. 配置块属性

| 属性 | 必填 | 说明 |
|------|------|------|
| `file` | ✅ | Lua 文件相对路径 |
| `key` | ✅ | Lua 变量路径，如 `Config.Stats.HP` |
| `type` | ✅ | 控件类型：`number`, `slider`, `string`, `boolean`, `select` |
| `label` | ❌ | 显示标签 |
| `min/max` | ❌ | 数值范围 |
| `step` | ❌ | 步进值 |
| `options` | ❌ | select 类型的选项列表 |
| `unit` | ❌ | 单位显示 |

### 3. 功能使用

- **跳转到源码**：`Ctrl+Click` 配置块中的 `key` 路径
- **查看当前值**：鼠标悬停在配置块上
- **命令面板**：`Ctrl+Shift+P` → "显示 Lua 变量值"

## 示例

### Lua 配置文件 (`player_config.lua`)

```lua
PlayerConfig = {
    BaseStats = {
        HP = 1000,      -- 基础生命值
        MP = 500,       -- 基础魔法值
        Attack = 100    -- 基础攻击力
    },
    Settings = {
        ShowTutorial = true,
        Language = "zh-CN"
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

## 新手引导

```lua-config
file: ./player_config.lua
key: PlayerConfig.Settings.ShowTutorial
type: boolean
label: 显示新手引导
```
````

## 开发

### 运行测试

```bash
npm test
```

### 调试插件

1. 在 VS Code 中按 `F5` 启动调试
2. 在新窗口中打开包含 `lua-config` 代码块的 Markdown 文件
3. 测试跳转、悬停等功能

## 路线图

- [x] 第一阶段：MVP 原型
- [ ] 第二阶段：Webview 可视化编辑器
- [ ] 第三阶段：双向绑定（修改即写入）
- [ ] 第四阶段：高级功能（智能补全、类型校验等）

## 技术栈

- TypeScript
- [luaparse](https://github.com/fstirlitz/luaparse) - Lua AST 解析
- VS Code Extension API

## License

MIT
