# Intelligent Markdown for Lua

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/liubai01.intelligent-markdown?style=flat-square&label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=liubai01.intelligent-markdown)
[![Visual Studio Marketplace Downloads](https://img.shields.io/visual-studio-marketplace/d/liubai01.intelligent-markdown?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=liubai01.intelligent-markdown)
[![Visual Studio Marketplace Rating](https://img.shields.io/visual-studio-marketplace/r/liubai01.intelligent-markdown?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=liubai01.intelligent-markdown)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

A VS Code extension for two-way binding between Markdown documents and Lua configuration files.

**[Install from VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=liubai01.intelligent-markdown)**

## Features

### Phase 1 (MVP) ✅

- ✅ **Lua AST Parsing**: Accurately parse Lua files and locate variables
- ✅ **Markdown Config Blocks**: Support `lua-config` fenced code block syntax
- ✅ **Document Links**: Click on keys in config blocks to jump to Lua source
- ✅ **Hover Preview**: Display current value and details on hover
- ✅ **Inline Values**: Show Lua variable values directly in the editor
- ✅ **Command Palette**: View all config bindings via commands

### Phase 2 (Webview Visual Editor) ✅

- ✅ **Visual Preview**: Render Markdown as a beautiful document interface
- ✅ **Config Controls**: Render `lua-config` blocks as editable controls
  - 📝 **Number Input**: With +/- buttons, supports min/max/step
  - 🎚️ **Slider**: Real-time drag to adjust values
  - 🔘 **Toggle Switch**: Quick boolean toggle
  - 📋 **Dropdown Select**: Preset option list
  - ✏️ **Text Input**: String editing
- ✅ **Two-way Binding**: Control changes automatically sync to Lua files
- ✅ **Jump to Source**: Click locate button to jump to Lua code
- ✅ **Auto-open Preview**: Configurable auto-preview when opening Markdown

## Installation

### From VS Code Marketplace

**[📦 Install from Marketplace](https://marketplace.visualstudio.com/items?itemName=liubai01.intelligent-markdown)**

Or search for **"Intelligent Markdown for Lua"** in VS Code Extensions (`Ctrl+Shift+X`).

### From Source

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Development mode (watch)
npm run watch
```

## Usage

### 1. Create Config Markdown

Use `lua-config` code blocks in Markdown files to define Lua variable bindings:

````markdown
# Player Config

```lua-config
file: ./scripts/player_config.lua
key: PlayerConfig.BaseStats.HP
type: number
min: 100
max: 10000
label: Base Health
```
````

### 2. Open Config Preview

- **Option 1**: Click the preview icon 📖 in the top-right corner
- **Option 2**: `Ctrl+Shift+P` → "Open Config Preview"
- **Option 3**: Enable auto-preview (see configuration below)

### 3. Config Block Properties

| Property | Required | Description |
|----------|----------|-------------|
| `file` | ✅ | Relative path to Lua file |
| `key` | ✅ | Lua variable path, e.g., `Config.Stats.HP` |
| `type` | ✅ | Control type: `number`, `slider`, `string`, `boolean`, `select` |
| `label` | ❌ | Display label |
| `min/max` | ❌ | Value range |
| `range` | ❌ | Range for slider type, format `[min, max]` |
| `step` | ❌ | Step increment |
| `options` | ❌ | Option list for select type |
| `unit` | ❌ | Unit display |

### 4. Extension Settings

Search `intelligentMarkdown` in VS Code settings:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `autoSave` | boolean | `true` | Auto-save Lua file changes |
| `showInlineValues` | boolean | `true` | Show inline values in editor |
| `autoOpenPreview` | boolean | `false` | Auto-open preview for Markdown files |
| `autoOpenPreviewPattern` | string | `**/*.config.md` | Glob pattern for auto-preview |
| `autoOpenPreviewOnlyWithLuaConfig` | boolean | `true` | Only auto-preview if file contains lua-config blocks |

#### Recommended Configuration

```json
{
  "intelligentMarkdown.autoOpenPreview": true,
  "intelligentMarkdown.autoOpenPreviewPattern": "**/*.md",
  "intelligentMarkdown.autoOpenPreviewOnlyWithLuaConfig": true
}
```

## Example

### Lua Config File (`player_config.lua`)

```lua
PlayerConfig = {
    BaseStats = {
        HP = 1000,      -- Base health
        MP = 500,       -- Base mana
        Attack = 100,   -- Base attack
        MoveSpeed = 200 -- Movement speed
    },
    Settings = {
        ShowTutorial = true,
        Language = "en-US",
        Difficulty = "normal"
    }
}
```

### Markdown Config Document (`config.md`)

````markdown
# Player Attributes

## Base Health

```lua-config
file: ./player_config.lua
key: PlayerConfig.BaseStats.HP
type: slider
range: [100, 10000]
step: 100
label: Max Health
```

## Movement Speed

```lua-config
file: ./player_config.lua
key: PlayerConfig.BaseStats.MoveSpeed
type: number
min: 100
max: 500
step: 10
unit: units/sec
label: Base Move Speed
```

## Tutorial

```lua-config
file: ./player_config.lua
key: PlayerConfig.Settings.ShowTutorial
type: boolean
label: Show Tutorial
```

## Difficulty

```lua-config
file: ./player_config.lua
key: PlayerConfig.Settings.Difficulty
type: select
options:
  - { value: "easy", label: "Easy" }
  - { value: "normal", label: "Normal" }
  - { value: "hard", label: "Hard" }
label: Game Difficulty
```
````

## Development

### Run Tests

```bash
npm test
```

### Debug Extension

1. Select "Run Extension (Compile First)" configuration
2. Press `F5` to start debugging
3. Open a Markdown file containing `lua-config` blocks
4. Click preview button or use command to open preview

### Debug Configurations

| Config Name | Description |
|-------------|-------------|
| Run Extension | Start watch mode (hot reload) |
| Run Extension (Compile First) | Compile then start (recommended) |
| Run Extension (No Build) | Start directly without compilation |

## Roadmap

- [x] Phase 1: MVP Prototype
- [x] Phase 2: Webview Visual Editor
- [x] Phase 3: Two-way Binding
- [ ] Phase 4: Advanced Features (auto-complete, type validation, array editing)

## Tech Stack

- TypeScript
- [luaparse](https://github.com/fstirlitz/luaparse) - Lua AST parsing
- VS Code Extension API
- VS Code Webview API

## Project Structure

```
intelligent-markdown/
├── src/
│   ├── extension.ts            # Extension entry
│   ├── core/                   # Core modules
│   │   ├── parser/             # Parsers (Lua, Markdown)
│   │   ├── linker/             # Linkers (path resolution)
│   │   └── patcher/            # Patchers (value write-back)
│   ├── editor/                 # Webview editor
│   ├── providers/              # VS Code providers
│   └── types/                  # Type definitions
├── test/                       # Test files
│   ├── fixtures/               # Test fixtures
│   └── unit/                   # Unit tests
└── docs/                       # Documentation
```

## License

MIT

---

**[⭐ Star on GitHub](https://github.com/liubai01/IntelligentMarkdown)** | **[📦 VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=liubai01.intelligent-markdown)** | **[🐛 Report Issues](https://github.com/liubai01/IntelligentMarkdown/issues)**
