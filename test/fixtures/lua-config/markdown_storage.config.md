# Markdown Storage Fixture

This fixture validates `lua-config` blocks with local markdown persistence.

Expected behavior:

- No external source file is required (`file` omitted).
- Value changes are written back into the same block's `value` field.
- `key` still identifies each config block.

```lua-config
storage: markdown
key: LocalSettings.EnableDebug
type: boolean
label: Enable Debug
value: false
```

```lua-config
storage: markdown
key: LocalSettings.MaxSpawnCount
type: number
label: Max Spawn Count
min: 1
max: 500
step: 5
value: 120
```

```lua-config
storage: markdown
key: LocalSettings.Difficulty
type: select
label: Difficulty
options:
  - { value: "easy", label: "Easy" }
  - { value: "normal", label: "Normal" }
  - { value: "hard", label: "Hard" }
value: normal
```

```lua-config
storage: markdown
key: LocalSettings.ItemTable
type: table
label: Item Table
columns:
  - { key: "id", label: "ID", type: "number", readonly: true, width: "80px" }
  - { key: "name", label: "Name", type: "string", width: "180px" }
  - { key: "enabled", label: "Enabled", type: "boolean", width: "120px" }
value:
  - { id: 1, name: "Potion", enabled: true }
  - { id: 2, name: "Elixir", enabled: false }
```

```lua-config
storage: markdown
key: LocalSettings.OnInitScript
type: code
label: On Init Script
value: |
  function LocalSettings.onInit()
    print("markdown storage init")
  end
```

