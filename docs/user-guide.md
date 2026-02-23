# User Guide

This guide is for everyday users who want to edit configuration through Markdown.  
For full field-level syntax details, see [lua-config Reference](./lua-config-reference.md).

Current source support:

- Lua (full workflow)
- JSON/JSONC (value + table workflows)

## Who This Is For

- Designers and planners who want a visual config workflow
- Engineers who still maintain source files directly
- Project maintainers who want one documented config entrypoint

## Quick Start

### Prepare a Lua config file

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

### Create a Markdown config document

````markdown
# Game Configuration

## Player

```lua-config
file: ./game_config.lua
key: GameConfig.Player.MaxHealth
type: slider
range: [50, 200]
step: 10
label: Max Health
```

```lua-config
file: ./game_config.lua
key: GameConfig.Player.Name
type: string
label: Player Name
```

## Settings

```lua-config
file: ./game_config.lua
key: GameConfig.Settings.SoundEnabled
type: boolean
label: Enable Sound
```
````

### Open the preview editor

- Click the preview icon in the editor title bar
- Or run `Open Config Preview` from the Command Palette

### JSON quick start (phase 1)

You can also bind to `.json` / `.jsonc` files using the same `lua-config` block syntax:

````markdown
```lua-config
file: ./game_json_config.json
key: GameConfig.Player.MaxHealth
type: number
min: 1
max: 9999
label: Player Max Health
```
````

> JSON support now includes basic value bindings, probe navigation, and table editing (`type: table`) for arrays of objects.

## Common Capabilities

### Visual editing and sync

- Values edited in preview are written back to source files
- `table` and `code` blocks are initialized lazily for better initial render performance

### Source navigation

- Jump from preview cards to source locations
- Use `probe://` links to jump to markers, functions, variable paths, or JSON paths

### Multi-step wizard

- `lua-wizard` supports:
  - `append`: append template-generated entries into Lua tables
  - `run`: execute template-generated command sequences with confirmation
- See [Config Wizard Guide](./wizard.md)

### Mermaid and interactive nodes

- Mermaid diagrams render in preview
- Diagram nodes can navigate with `click` + `probe://`

## Extension Settings

Search `intelligentMarkdown` in VS Code Settings:

| Setting | Default | Description |
|---|---|---|
| `intelligentMarkdown.autoSave` | `true` | Auto-save Lua files after updates |
| `intelligentMarkdown.showInlineValues` | `true` | Show inline values in Markdown editor |
| `intelligentMarkdown.autoOpenPreview` | `true` | Auto-open preview when Markdown opens |
| `intelligentMarkdown.autoOpenPreviewPattern` | `**/*.config.md` | File pattern for auto-open preview |

Example:

```json
{
  "intelligentMarkdown.autoOpenPreview": true,
  "intelligentMarkdown.autoOpenPreviewPattern": "**/config/**/*.md"
}
```

## Troubleshooting

### "File not found"

- Check that `file` is relative to the Markdown document
- Use `/` separators consistently
- Verify the Lua file exists and is readable

### "Variable not found"

- Check the `key` path matches the Lua structure exactly
- Ensure the Lua file has valid syntax

### Changes not applied

- Confirm the file is writable
- Check VS Code output panel for errors
- Try manual refresh in preview

## Continue Reading

- [Documentation Home](./overview.md)
- [Terminology](./terminology.md)
- [lua-config Reference](./lua-config-reference.md)
- [Config Wizard Guide](./wizard.md)
- [Architecture](./architecture.md)
