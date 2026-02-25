# Config Wizard Guide

`lua-wizard` is the current Markdown syntax identifier for wizard blocks (kept for compatibility).  
At the product level, this is called a **Wizard Block**.
It collects inputs and performs an action.
Three action types are currently supported:

- `append`: generate content from a template and append it to a Lua table
- `run`: render commands from a template and execute them sequentially
- `prompt`: generate a prompt from template variables and send it to AI chat ([Cursor](https://www.cursor.com/) / [CodeBuddy](https://codebuddy.ai/))

## Quick Examples

### Append a Lua entry

````markdown
```lua-wizard
file: ./items_config.lua
target: ItemsConfig.Weapons
action: append
label: Create New Weapon
icon: ⚔️
template: |
  { id = {{id}}, name = "{{name}}", attack = {{attack}}, price = {{price}}, stackable = {{stackable}} }
steps:
  - field: id
    label: Weapon ID
    type: number
    min: 1001
    default: 1005
  - field: name
    label: Weapon Name
    type: string
    default: New Weapon
  - field: attack
    label: Attack
    type: number
    min: 1
    max: 999
    default: 50
  - field: price
    label: Price
    type: number
    min: 0
    default: 100
  - field: stackable
    label: Stackable
    type: boolean
    default: false
```
````

### Run a command sequence

````markdown
```lua-wizard
file: ./package.json
action: run
label: Release Preparation
icon: 🚀
cwd: .
variables:
  version:
    type: json
    file: ./package.json
    path: version
commands: |
  echo Current version: {{version}}
  npm test
steps:
  - field: confirm
    label: I have completed pre-checks
    type: boolean
    default: false
```
````

> `run` always asks for execution confirmation and logs output per command.

### Generate a prompt for AI chat

The `prompt` action works with AI-powered editors that support chat integration, including:

- [Cursor](https://www.cursor.com/) — AI-first code editor
- [CodeBuddy](https://codebuddy.ai/) — Tencent's AI coding assistant

````markdown
```lua-wizard
file: ./game_config.json
action: prompt
label: Generate Release Prompt
icon: 🤖
prompt: |
  You are helping with a game release verification.

  Context:
  - Player Name: {{playerName}}
  - Max HP: {{playerHp}}
  - Build Environment: {{env}}

  Tasks:
  1) Check release risk for current config.
  2) Propose 3 validation commands for smoke testing.
  3) Return a short release checklist in markdown.

variables:
  playerName:
    type: json
    file: ./game_config.json
    path: GameConfig.Player.Name
  playerHp:
    type: json
    file: ./game_config.json
    path: GameConfig.Player.MaxHealth

steps:
  - field: env
    label: Target Environment
    type: select
    options:
      - { value: "dev", label: "Development" }
      - { value: "staging", label: "Staging" }
      - { value: "prod", label: "Production" }
    default: staging
  - field: confirm
    label: I want to generate an AI prompt
    type: boolean
    default: true
```
````

> `prompt` renders the `prompt` template with step inputs and dynamic variables, then sends the result to the AI chat panel (Cursor or CodeBuddy) for AI-assisted execution.

## Field Reference

### Top-level fields

| Field | Required | Description |
|---|---|---|
| `file` | required for `append`, recommended for `run` and `prompt` | Reference file path (relative to Markdown file) |
| `action` | no | `append`, `run`, or `prompt`, defaults to `append` |
| `target` | required for `append` | Target Lua table path, e.g. `ItemsConfig.Weapons` |
| `template` | required for `append` | Template with `{{variable}}` placeholders |
| `commands` | required for `run` | Multiline command template |
| `prompt` | required for `prompt` | Multiline prompt template with `{{variable}}` placeholders |
| `cwd` | no | Working directory for `run`, defaults to Markdown directory |
| `label` | no | Wizard title |
| `icon` | no | Wizard icon |
| `steps` | yes | Input step definitions |
| `variables` | no | Dynamic variable injection definitions |

### Step fields (`steps[]`)

| Field | Required | Description |
|---|---|---|
| `field` | yes | Variable name used by `{{field}}` |
| `label` | yes | Display label |
| `type` | yes | `number` / `string` / `boolean` / `select` |
| `default` | no | Default value |
| `description` | no | Help text |
| `min` `max` `step` | no | Numeric constraints |
| `options` | no | Options for `select` |
| `required` | no | Defaults to `true` |

### Dynamic variables (`variables`)

`variables` reads values from external files and injects them into template rendering.  
Currently supported types: `json`, `config`.

```yaml
variables:
  appVersion:
    type: json
    file: ./package.json
    path: version
```

This makes `{{appVersion}}` available during rendering.

#### Read from existing `lua-config` blocks (`type: config`)

You can reference values already defined in the same markdown page, including:

- values linked from Lua/JSON source files
- values persisted directly in markdown (`storage: markdown`)

```yaml
variables:
  hp:
    type: config
    path: GameConfig.Player.MaxHealth
```

When keys conflict, bind a stable markdown-level alias in the config block:

```lua-config
file: ./game_config.lua
key: GameConfig.Player.MaxHealth
markdown-key: player-hp
type: number
```

Then use that alias in wizard variables:

```yaml
variables:
  hp:
    type: config
    markdown-key: player-hp
```

Rules:

- `type: config` supports either `path` or `markdown-key`
- if both are provided, `markdown-key` takes priority
- default behavior reuses `key` when `markdown-key` is not specified

## Template Rules

- Placeholder syntax: `{{name}}`
- String quoting is controlled by your template (no automatic quotes)
- Booleans are rendered as `true` / `false`
- Multiline templates are recommended with YAML `|`

## Execution Behavior

### append

- Locates the `target` Lua table
- Appends content before the table closing brace
- Reuses existing indentation style when possible
- Auto-adds a trailing comma to the previous item when needed

### run

- Renders `commands` and executes line by line
- Ignores empty lines and comment lines starting with `#`
- Stops at first failed command
- Writes logs to the `Wizard Commands` output channel

### prompt

- Renders the `prompt` template by substituting step inputs and dynamic `variables`
- Sends the rendered prompt text to the AI chat panel for AI-assisted execution
- Compatible with [Cursor](https://www.cursor.com/) and [CodeBuddy](https://codebuddy.ai/)
- Supports `variables` for injecting values from external JSON files
- Useful for code generation, review checklists, and AI-powered workflows

## Troubleshooting

- `Target not found`: verify `target` exists in Lua source
- `Target is not a table`: `append` only works with table targets
- `No commands to execute`: check rendered `commands` result
- Path issues: keep paths relative to Markdown and use `/` consistently
