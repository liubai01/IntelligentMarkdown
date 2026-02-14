# lua-config Reference

> config.md syntax reference for `lua-config` blocks.

---

## Block Syntax

A config block is a fenced code block with language `lua-config`, written in YAML:

````markdown
```lua-config
file: ./path/to/file.lua
key: Table.Key.Path
type: slider
label: Display Name
```
````

---

## Required Fields

| Field  | Type     | Description                        |
|--------|----------|------------------------------------|
| `file` | `string` | Relative path to the Lua file      |
| `key`  | `string` | Dot-separated Lua variable path    |
| `type` | `string` | Control type (see [Types](#types))  |

---

## Optional Fields

| Field      | Type                | Applies To               | Description                      |
|------------|---------------------|--------------------------|----------------------------------|
| `label`    | `string`            | all                      | Display label (defaults to last segment of `key`) |
| `default`  | `any`               | all                      | Default value                    |
| `min`      | `number`            | `number`, `slider`       | Minimum value                    |
| `max`      | `number`            | `number`, `slider`       | Maximum value                    |
| `range`    | `[min, max]`        | `slider`                 | Shorthand for `min` + `max`      |
| `step`     | `number`            | `number`, `slider`       | Increment step (default: `1`)    |
| `unit`     | `string`            | `number`, `slider`       | Unit suffix displayed after the control |
| `readonly` | `boolean`           | all                      | Make the control read-only       |
| `options`  | `SelectOption[]`    | `select`                 | Dropdown options list            |
| `columns`  | `TableColumn[]`     | `table`                  | Column definitions for table     |

---

## Types

### `number`

Numeric input with +/− buttons.

```lua-config
file: ./config.lua
key: Config.SpawnRate
type: number
min: 1
max: 100
step: 5
unit: "/sec"
label: Spawn Rate
```

| Param  | Type     | Default | Description       |
|--------|----------|---------|-------------------|
| `min`  | `number` | —       | Minimum allowed   |
| `max`  | `number` | —       | Maximum allowed   |
| `step` | `number` | `1`     | Increment step    |
| `unit` | `string` | —       | Unit label        |

---

### `slider`

Range slider with live value display.

```lua-config
file: ./config.lua
key: Config.Player.HP
type: slider
range: [100, 5000]
step: 100
label: Max HP
```

| Param   | Type          | Default  | Description             |
|---------|---------------|----------|-------------------------|
| `min`   | `number`      | `0`      | Slider minimum          |
| `max`   | `number`      | `100`    | Slider maximum          |
| `range` | `[min, max]`  | —        | Shorthand for min + max |
| `step`  | `number`      | `1`      | Increment step          |
| `unit`  | `string`      | —        | Unit label              |

---

### `boolean`

Toggle switch (on/off).

```lua-config
file: ./config.lua
key: Config.Settings.SoundEnabled
type: boolean
label: Enable Sound
```

No additional parameters.

---

### `string`

Text input field.

```lua-config
file: ./config.lua
key: Config.Player.Name
type: string
label: Player Name
```

No additional parameters.

---

### `select`

Dropdown select from predefined options.

```lua-config
file: ./config.lua
key: Config.Settings.Difficulty
type: select
options:
  - { value: "easy", label: "Easy" }
  - { value: "normal", label: "Normal" }
  - { value: "hard", label: "Hard" }
label: Difficulty
```

| Param     | Type              | Description         |
|-----------|-------------------|---------------------|
| `options` | `SelectOption[]`  | **Required.** List of options |

**SelectOption:**

| Field   | Type               | Description     |
|---------|--------------------|-----------------|
| `value` | `string \| number` | Stored value    |
| `label` | `string`           | Display text    |

---

### `table`

Spreadsheet-style editor for arrays of Lua objects.

```lua-config
file: ./items.lua
key: Items.Weapons
type: table
label: Weapon List
columns:
  - { key: "id",     label: "ID",     type: "number", readonly: true, width: "80px" }
  - { key: "name",   label: "Name",   type: "string", width: "150px" }
  - { key: "attack", label: "ATK",    type: "number", min: 1, max: 999, width: "120px" }
  - { key: "rare",   label: "Rarity", type: "select", width: "120px",
      options: [{ value: "common", label: "Common" }, { value: "rare", label: "Rare" }] }
```

| Param     | Type             | Description                    |
|-----------|------------------|--------------------------------|
| `columns` | `TableColumn[]`  | **Required.** Column definitions |

**TableColumn:**

| Field      | Type             | Required | Description                          |
|------------|------------------|----------|--------------------------------------|
| `key`      | `string`         | ✅       | Lua field name in each table entry   |
| `label`    | `string`         | ✅       | Column header text                   |
| `type`     | `string`         | ✅       | `"number"` `"string"` `"boolean"` `"select"` |
| `min`      | `number`         |          | Min value (number columns)           |
| `max`      | `number`         |          | Max value (number columns)           |
| `step`     | `number`         |          | Step (number columns)                |
| `options`  | `SelectOption[]` |          | Options (select columns)             |
| `readonly` | `boolean`        |          | Make column read-only                |
| `width`    | `string`         |          | CSS width (e.g. `"120px"`)           |

---

### `color`

> ⚠️ Declared but not yet implemented. Reserved for future use.

---

### `array`

> ⚠️ Declared but not yet implemented. Reserved for future use.

---

## Link Status

Each block shows a status indicator:

| Status | Icon | Meaning                    |
|--------|------|----------------------------|
| `ok`             | ✅ | Lua file found, key resolved, value linked |
| `file-not-found` | ❌ | Lua file does not exist at the given path  |
| `key-not-found`  | ❌ | Key path not found in the Lua file         |
| `parse-error`    | ❌ | Lua file could not be parsed               |

---

## VS Code Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `intelligentMarkdown.autoSave` | `boolean` | `true` | Auto-save Lua file after editing |
| `intelligentMarkdown.showInlineValues` | `boolean` | `true` | Show inline value decorations |
| `intelligentMarkdown.autoOpenPreview` | `boolean` | `true` | Auto-open preview panel |
| `intelligentMarkdown.autoOpenPreviewPattern` | `string` | `**/*.config.md` | Glob pattern for auto-preview |
| `intelligentMarkdown.autoOpenPreviewOnlyWithLuaConfig` | `boolean` | `true` | Only auto-open if file has `lua-config` blocks |

---

## Quick Examples

<details>
<summary><b>Slider with range</b></summary>

```lua-config
file: ./game.lua
key: Game.Player.Speed
type: slider
range: [0, 500]
step: 10
unit: "m/s"
label: Move Speed
```
</details>

<details>
<summary><b>Boolean toggle</b></summary>

```lua-config
file: ./game.lua
key: Game.Debug.Enabled
type: boolean
label: Debug Mode
```
</details>

<details>
<summary><b>Select dropdown</b></summary>

```lua-config
file: ./game.lua
key: Game.Language
type: select
options:
  - { value: "en", label: "English" }
  - { value: "zh", label: "中文" }
  - { value: "ja", label: "日本語" }
label: Language
```
</details>

<details>
<summary><b>Table editor</b></summary>

```lua-config
file: ./items.lua
key: Items.List
type: table
label: Item Database
columns:
  - { key: "id", label: "ID", type: "number", readonly: true, width: "60px" }
  - { key: "name", label: "Name", type: "string", width: "150px" }
  - { key: "price", label: "Price", type: "number", min: 0, max: 99999, width: "100px" }
  - { key: "enabled", label: "Active", type: "boolean", width: "80px" }
```
</details>
