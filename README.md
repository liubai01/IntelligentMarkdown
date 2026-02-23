<p align="center">
  <img src="images/banner.png" alt="config.md banner" width="800" />
</p>

<h1 align="center">config.md</h1>

<p align="center">
  <strong>Manage configuration through Markdown — write docs, embed config blocks, edit visually.</strong>
</p>

<p align="center">
  <a href="https://github.com/liubai01/IntelligentMarkdown/actions/workflows/ci.yml"><img src="https://github.com/liubai01/IntelligentMarkdown/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=liubai01.config-md"><img src="https://img.shields.io/visual-studio-marketplace/v/liubai01.config-md?style=flat-square&label=VS%20Code%20Marketplace" alt="Version" /></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=liubai01.config-md"><img src="https://img.shields.io/visual-studio-marketplace/d/liubai01.config-md?style=flat-square" alt="Downloads" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square" alt="License: MIT" /></a>
</p>

---

## 💡 What is config.md?

**config.md** is a VS Code extension that lets you manage configuration through Markdown documents. Write human-readable docs with embedded config blocks, then edit values in a visual UI that writes back to source files.

> 🎯 Product direction: language-agnostic config workflows with pluggable source adapters.
> Today: strong Lua support + incremental JSON/JSONC support.

### Naming Conventions

- **Product name**: `config.md`
- **Syntax identifiers**: `lua-config`, `lua-wizard` (kept for compatibility)
- **Language-neutral concepts**: Config Block, Wizard Block, Source Adapter

See docs: [Terminology](https://github.com/liubai01/IntelligentMarkdown/blob/master/docs/terminology.md).

### The Idea

Instead of editing raw config files, write a Markdown document that describes your configuration:

````markdown
# Game Settings

## Player Health

```lua-config
file: ./game_config.lua
key: GameConfig.Player.MaxHealth
type: slider
range: [50, 200]
label: Maximum Health
```
````

Open the preview panel, and you get an interactive visual editor — sliders, toggles, dropdowns — that syncs changes back to your source files in real time.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🎨 **Visual Editor** | Edit config values with sliders, toggles, dropdowns, input fields, and tables |
| 🔄 **Two-way Sync** | Changes in the visual editor auto-sync to source files |
| 📝 **Markdown Native** | Your config docs *are* the config editor — document and edit in one place |
| 🎯 **Jump to Source** | Click any value to navigate directly to source code |
| ⚡ **Real-time Preview** | See changes instantly as you type |
| 📊 **Table Editing** | Batch-edit arrays of objects in a spreadsheet-like interface |
| 💻 **Function Editor** | Edit Lua functions in VS Code's native editor — with full IntelliSense, go-to-definition, and staged save |
| 🤖 **AI Prompt Templating** | Build reusable `lua-wizard` prompt templates from config variables and step inputs, then send generated prompts directly into Cursor chat |
| 🌐 **Adapter Expansion** | Designed to evolve from Lua-first into language-agnostic config editing |

---

## 🚀 Quick Start

### 1. Create a Lua Config File

```lua
-- game_config.lua
GameConfig = {
    Player = {
        MaxHealth = 100,
        MoveSpeed = 5.0
    },
    Settings = {
        SoundEnabled = true,
        Difficulty = "normal"
    }
}
```

### 2. Create a Markdown Config Document

````markdown
# Game Configuration

## Player Health

```lua-config
file: ./game_config.lua
key: GameConfig.Player.MaxHealth
type: slider
range: [50, 200]
label: Maximum Health
```

## Sound Settings

```lua-config
file: ./game_config.lua
key: GameConfig.Settings.SoundEnabled
type: boolean
label: Enable Sound
```

## Difficulty

```lua-config
file: ./game_config.lua
key: GameConfig.Settings.Difficulty
type: select
options:
  - { value: "easy", label: "Easy" }
  - { value: "normal", label: "Normal" }
  - { value: "hard", label: "Hard" }
label: Game Difficulty
```
````

### 3. Open the Visual Preview

Click the **preview icon** (📖) in the top-right corner, or press `Ctrl+Shift+P` → **"config.md: Open Config Preview"**

---

## 🎮 Control Types

| Type | Best For | Example |
|------|----------|---------|
| `slider` | Bounded numbers | Health, Speed |
| `number` | Precise numbers | Coordinates, IDs |
| `boolean` | On/Off toggles | Sound, Debug mode |
| `select` | Choice from list | Difficulty, Language |
| `string` | Text values | Names, Paths |
| `table` | Array of objects | Item lists, Character stats |

## 🧩 Format Support

| Source format | Status | Notes |
|------|--------|-------|
| Lua | ✅ Mature | Full binding, table editing, code editing, wizard |
| JSON / JSONC | ✅ Active | Value binding, probe navigation, value editing, table editing |
| YAML / TOML | 🧭 Planned | Targeted through adapter-based architecture |

---

## 📋 Config Block Reference

### Required Properties

```yaml
file: ./path/to/config.lua    # Relative path to Lua file
key: Config.Player.HP         # Lua variable path
type: number                  # Control type
```

### Optional Properties

```yaml
label: "Display Name"         # Custom label
min: 0                        # Minimum value (number)
max: 100                      # Maximum value (number)
range: [0, 100]               # Range for slider
step: 5                       # Increment step
unit: "px"                    # Unit display
options:                      # For select type
  - { value: "a", label: "Option A" }
columns:                      # For table type (array of objects)
  - { key: "id", label: "ID", type: "number", readonly: true }
  - { key: "name", label: "Name", type: "string" }
  - { key: "value", label: "Value", type: "number", min: 0, max: 100 }
```

### Table Type Example

````markdown
```lua-config
file: ./items.lua
key: Items.Weapons
type: table
label: Weapon Configuration
columns:
  - { key: "id", label: "ID", type: "number", readonly: true, width: "80px" }
  - { key: "name", label: "Weapon Name", type: "string", width: "150px" }
  - { key: "attack", label: "Attack Power", type: "number", min: 1, max: 999, width: "120px" }
  - { key: "price", label: "Price", type: "number", min: 0, max: 99999, width: "100px" }
  - { key: "rare", label: "Rarity", type: "select", width: "120px",
      options: [{ value: "common", label: "Common" }, { value: "rare", label: "Rare" }] }
```
````

---

## ⚙️ Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `intelligentMarkdown.autoSave` | `true` | Auto-save Lua files after changes |
| `intelligentMarkdown.autoOpenPreview` | `true` | Auto-open preview for config files |
| `intelligentMarkdown.autoOpenPreviewPattern` | `**/*.config.md` | Glob pattern for auto-preview |

### Recommended Configuration

```json
{
  "intelligentMarkdown.autoOpenPreview": true,
  "intelligentMarkdown.autoOpenPreviewPattern": "**/*.md"
}
```

---

## 📖 Full Example

### Lua File (`player_config.lua`)

```lua
PlayerConfig = {
    BaseStats = {
        HP = 1000,
        MP = 500,
        Attack = 100,
        Defense = 50,
        MoveSpeed = 200
    },
    Settings = {
        ShowTutorial = true,
        Language = "en-US",
        Difficulty = "normal"
    }
}
```

### Markdown Document (`player.config.md`)

````markdown
# Player Configuration

A visual editor for player settings.

## Base Stats

### Health Points

```lua-config
file: ./player_config.lua
key: PlayerConfig.BaseStats.HP
type: slider
range: [100, 5000]
step: 100
label: Max HP
```

### Movement Speed

```lua-config
file: ./player_config.lua
key: PlayerConfig.BaseStats.MoveSpeed
type: number
min: 100
max: 500
step: 10
unit: units/sec
label: Move Speed
```

## Game Settings

### Tutorial

```lua-config
file: ./player_config.lua
key: PlayerConfig.Settings.ShowTutorial
type: boolean
label: Show Tutorial on First Launch
```

### Difficulty

```lua-config
file: ./player_config.lua
key: PlayerConfig.Settings.Difficulty
type: select
options:
  - { value: "easy", label: "Easy Mode" }
  - { value: "normal", label: "Normal Mode" }
  - { value: "hard", label: "Hard Mode" }
  - { value: "nightmare", label: "Nightmare Mode" }
label: Game Difficulty
```
````

---

## 🗺️ Roadmap

- [x] Lua configuration support
- [x] JSON / JSONC support
- [ ] YAML / TOML adapters
- [ ] Custom theme for visual editor
- [ ] Export config snapshots
- [ ] Config validation rules

---

## 🛠️ Development

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Run tests
npm test

# Watch mode
npm run watch
```

---

## 📚 Documentation

- 📗 [**lua-config Reference**](https://github.com/liubai01/IntelligentMarkdown/blob/master/docs/lua-config-reference.md) — Complete syntax reference for `lua-config` blocks
- 📖 [User Guide](https://github.com/liubai01/IntelligentMarkdown/blob/master/docs/user-guide.md) — Detailed usage instructions
- 🏗️ [Architecture](https://github.com/liubai01/IntelligentMarkdown/blob/master/docs/architecture.md) — Technical documentation
- 🧭 [Product Strategy](https://github.com/liubai01/IntelligentMarkdown/blob/master/docs/product-strategy.md) — Language-agnostic product direction

---

## 📝 Changelog

### v0.3.1

- 💻 New `code` type: edit Lua functions in VS Code's native editor with full language support
- 🔧 Staged save workflow: edit in temp file, click "Apply" to write back to source

### v0.3.0

- 🎨 Brand upgrade: renamed to **config.md**
- 🖼️ New icon and marketplace banner
- 🔧 Improved preview panel reuse (no more extra windows)

### v0.2.2

- 🔧 Reuse preview panel to avoid creating too many windows

### v0.2.1

- 📖 Add comprehensive User Guide documentation
- 📝 Improve README with better quick start guide
- 🔧 Fix ESLint configuration for CI
- 🐛 Fix Lua string value parsing issue

### v0.2.0

- ✨ Visual Webview editor with multiple control types
- 🔄 Two-way binding between Markdown and Lua
- 🎯 Jump to Lua source from preview
- ⚙️ Configurable auto-preview settings

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### For Developers

- **[Release Process](docs/quick-release.md)** - How to publish new versions
- **[Documentation](docs/)** - Complete developer documentation

---

## 📄 License

MIT © [liubai01](https://github.com/liubai01)

---

<p align="center">
  <a href="https://github.com/liubai01/IntelligentMarkdown"><strong>⭐ Star on GitHub</strong></a> · 
  <a href="https://github.com/liubai01/IntelligentMarkdown/blob/master/docs/lua-config-reference.md"><strong>📗 Reference</strong></a> · 
  <a href="https://github.com/liubai01/IntelligentMarkdown/issues"><strong>🐛 Report Issues</strong></a> · 
  <a href="https://github.com/liubai01/IntelligentMarkdown/blob/master/docs/user-guide.md"><strong>📖 User Guide</strong></a>
</p>
