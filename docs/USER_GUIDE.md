# User Guide

This guide will help you get started with **Intelligent Markdown for Lua** - a VS Code extension that enables visual editing of Lua configuration files through Markdown documents.

## Table of Contents

- [Getting Started](#getting-started)
- [Creating Your First Config Document](#creating-your-first-config-document)
- [Control Types](#control-types)
- [Config Block Reference](#config-block-reference)
- [Extension Settings](#extension-settings)
- [Tips & Best Practices](#tips--best-practices)
- [Troubleshooting](#troubleshooting)

---

## Getting Started

### Installation

1. Open VS Code
2. Press `Ctrl+Shift+X` to open Extensions
3. Search for **"Intelligent Markdown for Lua"**
4. Click **Install**

Or install directly from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=liubai01.intelligent-markdown).

### Quick Start

1. Create a Lua config file (e.g., `config.lua`)
2. Create a Markdown file (e.g., `config.md`)
3. Add `lua-config` code blocks to your Markdown
4. Click the preview icon (📖) in the top-right corner
5. Edit values in the visual preview - changes sync to Lua automatically!

---

## Creating Your First Config Document

### Step 1: Create a Lua Configuration File

Create a file named `game_config.lua`:

```lua
GameConfig = {
    Player = {
        MaxHealth = 100,
        MoveSpeed = 5.0,
        Name = "Hero"
    },
    Settings = {
        SoundEnabled = true,
        Difficulty = "normal"
    }
}
```

### Step 2: Create a Markdown Config Document

Create a file named `game_config.md` in the same directory:

````markdown
# Game Configuration

Configure your game settings using the controls below.

## Player Settings

### Max Health

```lua-config
file: ./game_config.lua
key: GameConfig.Player.MaxHealth
type: slider
range: [50, 200]
step: 10
label: Maximum Health Points
```

### Movement Speed

```lua-config
file: ./game_config.lua
key: GameConfig.Player.MoveSpeed
type: number
min: 1.0
max: 10.0
step: 0.5
unit: m/s
label: Player Move Speed
```

### Player Name

```lua-config
file: ./game_config.lua
key: GameConfig.Player.Name
type: string
label: Player Display Name
```

## Game Settings

### Sound

```lua-config
file: ./game_config.lua
key: GameConfig.Settings.SoundEnabled
type: boolean
label: Enable Sound Effects
```

### Difficulty

```lua-config
file: ./game_config.lua
key: GameConfig.Settings.Difficulty
type: select
options:
  - { value: "easy", label: "Easy Mode" }
  - { value: "normal", label: "Normal Mode" }
  - { value: "hard", label: "Hard Mode" }
label: Game Difficulty
```
````

### Step 3: Open the Visual Preview

There are three ways to open the config preview:

1. **Click the preview icon** (📖) in the top-right corner of the editor
2. **Use Command Palette**: Press `Ctrl+Shift+P` and search for "Open Config Preview"
3. **Enable auto-preview** in settings (see [Extension Settings](#extension-settings))

---

## Control Types

### Number Input

Best for numeric values with optional constraints.

```yaml
type: number
min: 0          # Optional: minimum value
max: 100        # Optional: maximum value
step: 1         # Optional: increment step (default: 1)
unit: "px"      # Optional: unit label
```

**Features:**
- +/- buttons for quick adjustments
- Direct input field
- Respects min/max boundaries

### Slider

Best for numeric values within a defined range.

```yaml
type: slider
range: [0, 100]  # Required: [min, max]
step: 5          # Optional: step size
```

**Features:**
- Visual slider bar
- Real-time value display
- Smooth dragging

### Boolean Toggle

Best for on/off settings.

```yaml
type: boolean
```

**Features:**
- Simple toggle switch
- Shows ON/OFF state

### Dropdown Select

Best for choosing from predefined options.

```yaml
type: select
options:
  - { value: "option1", label: "Display Name 1" }
  - { value: "option2", label: "Display Name 2" }
  - { value: "option3", label: "Display Name 3" }
```

**Features:**
- Dropdown menu
- Custom display labels
- Type-safe value selection

### Text Input

Best for string values.

```yaml
type: string
```

**Features:**
- Text input field
- Press Enter or blur to save

---

## Config Block Reference

### Required Properties

| Property | Description | Example |
|----------|-------------|---------|
| `file` | Relative path to Lua file | `./config.lua` |
| `key` | Lua variable path | `Config.Player.HP` |
| `type` | Control type | `number`, `slider`, `boolean`, `select`, `string` |

### Optional Properties

| Property | Description | Applies To |
|----------|-------------|------------|
| `label` | Display label | All types |
| `min` | Minimum value | `number` |
| `max` | Maximum value | `number` |
| `range` | Value range `[min, max]` | `slider` |
| `step` | Increment step | `number`, `slider` |
| `unit` | Unit display (e.g., "px", "ms") | `number`, `slider` |
| `options` | Option list | `select` |

### Variable Path Syntax

The `key` property supports nested paths:

```yaml
# Simple path
key: PlayerHP

# Nested table path
key: Config.Player.Stats.HP

# Array index (1-based, Lua style)
key: Config.Items[1].Name

# String key with special characters
key: Config["special-key"].Value
```

---

## Extension Settings

Access settings via `File > Preferences > Settings` and search for `intelligentMarkdown`.

| Setting | Default | Description |
|---------|---------|-------------|
| `autoSave` | `true` | Automatically save Lua files after changes |
| `showInlineValues` | `true` | Show variable values inline in Markdown editor |
| `autoOpenPreview` | `false` | Auto-open preview when opening Markdown files |
| `autoOpenPreviewPattern` | `**/*.config.md` | Glob pattern for auto-preview files |
| `autoOpenPreviewOnlyWithLuaConfig` | `true` | Only auto-preview if file contains lua-config blocks |

### Recommended Settings for Game Development

```json
{
  "intelligentMarkdown.autoOpenPreview": true,
  "intelligentMarkdown.autoOpenPreviewPattern": "**/config/**/*.md",
  "intelligentMarkdown.autoOpenPreviewOnlyWithLuaConfig": true
}
```

---

## Tips & Best Practices

### Organize Your Config Files

```
project/
├── config/
│   ├── player.md          # Player config document
│   ├── enemies.md         # Enemy config document
│   └── settings.md        # Game settings document
├── scripts/
│   ├── player_config.lua  # Lua config files
│   ├── enemy_config.lua
│   └── settings.lua
```

### Use Descriptive Labels

```yaml
# ❌ Not helpful
label: HP

# ✅ Better
label: Player Maximum Health Points
```

### Group Related Settings

Use Markdown headers to organize related settings:

```markdown
# Player Configuration

## Combat Stats
<!-- HP, Attack, Defense configs -->

## Movement
<!-- Speed, Jump Height configs -->

## Appearance
<!-- Skin, Color configs -->
```

### Use Appropriate Control Types

| Value Type | Recommended Control |
|------------|---------------------|
| Integer (bounded) | `slider` |
| Float (precise) | `number` with step |
| Boolean | `boolean` |
| Enum/Choice | `select` |
| Free text | `string` |

---

## Troubleshooting

### Config block shows "File not found"

- Check the `file` path is relative to the Markdown file
- Ensure the Lua file exists
- Use forward slashes `/` even on Windows

### Config block shows "Variable not found"

- Verify the `key` path matches your Lua structure
- Check for typos in variable names
- Ensure the Lua file has valid syntax

### Changes not saving to Lua file

- Check if `autoSave` setting is enabled
- Ensure the Lua file is not read-only
- Check VS Code's Output panel for errors

### Preview not updating

- Try clicking the refresh button in the preview
- Close and reopen the preview
- Check for syntax errors in the Markdown file

---

## Need Help?

- 📖 [Full Documentation](https://github.com/liubai01/IntelligentMarkdown/tree/master/docs)
- 🐛 [Report Issues](https://github.com/liubai01/IntelligentMarkdown/issues)
- ⭐ [Star on GitHub](https://github.com/liubai01/IntelligentMarkdown)
