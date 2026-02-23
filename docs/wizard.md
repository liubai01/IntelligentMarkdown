# Lua Wizard Guide

`lua-wizard` is a Markdown-embedded wizard block that collects inputs and performs an action.  
Two action types are currently supported:

- `append`: generate content from a template and append it to a Lua table
- `run`: render commands from a template and execute them sequentially

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

## Field Reference

### Top-level fields

| Field | Required | Description |
|---|---|---|
| `file` | required for `append`, recommended for `run` | Reference file path (relative to Markdown file) |
| `action` | no | `append` or `run`, defaults to `append` |
| `target` | required for `append` | Target Lua table path, e.g. `ItemsConfig.Weapons` |
| `template` | required for `append` | Template with `{{variable}}` placeholders |
| `commands` | required for `run` | Multiline command template |
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
Currently supported type: `json`.

```yaml
variables:
  appVersion:
    type: json
    file: ./package.json
    path: version
```

This makes `{{appVersion}}` available during rendering.

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

## Troubleshooting

- `Target not found`: verify `target` exists in Lua source
- `Target is not a table`: `append` only works with table targets
- `No commands to execute`: check rendered `commands` result
- Path issues: keep paths relative to Markdown and use `/` consistently
