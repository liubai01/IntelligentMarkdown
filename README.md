# Intelligent Markdown for Lua

[![CI](https://github.com/liubai01/IntelligentMarkdown/actions/workflows/ci.yml/badge.svg)](https://github.com/liubai01/IntelligentMarkdown/actions/workflows/ci.yml)
[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/liubai01.intelligent-markdown?style=flat-square&label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=liubai01.intelligent-markdown)
[![Visual Studio Marketplace Downloads](https://img.shields.io/visual-studio-marketplace/d/liubai01.intelligent-markdown?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=liubai01.intelligent-markdown)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

**Visually edit Lua configuration files through Markdown documents with real-time two-way sync.**

Perfect for game developers, designers, and anyone who needs to edit Lua configs without touching code!

---

## ✨ Features

- 🎨 **Visual Config Editor** - Edit Lua values using sliders, toggles, dropdowns, and input fields
- 🔄 **Two-way Binding** - Changes in the visual editor automatically sync to Lua files
- 📝 **Markdown-based** - Document your configs with rich Markdown formatting
- 🎯 **Jump to Source** - Click to navigate directly to the Lua code
- ⚡ **Real-time Preview** - See changes instantly as you edit

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

Click the **preview icon** (📖) in the top-right corner, or press `Ctrl+Shift+P` → "Open Config Preview"

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

Use `table` type to batch edit arrays of Lua objects in a spreadsheet-like interface:

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

**Supported column types**: `number`, `string`, `boolean`, `select`

---

## ⚙️ Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `autoSave` | `true` | Auto-save Lua files after changes |
| `autoOpenPreview` | `false` | Auto-open preview for config files |
| `autoOpenPreviewPattern` | `**/*.config.md` | Pattern for auto-preview |

### Recommended Configuration

```json
{
  "intelligentMarkdown.autoOpenPreview": true,
  "intelligentMarkdown.autoOpenPreviewPattern": "**/*.md",
  "intelligentMarkdown.autoOpenPreviewOnlyWithLuaConfig": true
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

## 📚 Documentation

- 📖 [User Guide](https://github.com/liubai01/IntelligentMarkdown/blob/master/docs/USER_GUIDE.md) - Detailed usage instructions
- 🏗️ [Architecture](https://github.com/liubai01/IntelligentMarkdown/blob/master/docs/ARCHITECTURE.md) - Technical documentation

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

## 📝 Changelog

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

---

## 📄 License

MIT © [liubai01](https://github.com/liubai01)

---

**[⭐ Star on GitHub](https://github.com/liubai01/IntelligentMarkdown)** | **[🐛 Report Issues](https://github.com/liubai01/IntelligentMarkdown/issues)** | **[📖 User Guide](https://github.com/liubai01/IntelligentMarkdown/blob/master/docs/USER_GUIDE.md)**
