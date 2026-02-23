# Item Configuration

This document manages in-game item configurations with table-based batch editing support.

## Weapon List

Below is the configuration table for all weapons in the game. You can modify attributes directly in the table:

```lua-config
file: ./items_config.lua
key: ItemsConfig.Weapons
type: table
label: Weapon Config Table
columns:
  - { key: "id", label: "ID", type: "number", readonly: true, width: "80px" }
  - { key: "name", label: "Weapon Name", type: "string", width: "150px" }
  - { key: "attack", label: "Attack", type: "number", min: 1, max: 999, step: 5, width: "100px" }
  - { key: "price", label: "Price", type: "number", min: 0, max: 99999, step: 10, width: "100px" }
  - { key: "stackable", label: "Stackable", type: "boolean", width: "80px" }
```

## Potion List

Potion effect types can be selected from a dropdown menu:

```lua-config
file: ./items_config.lua
key: ItemsConfig.Potions
type: table
label: Potion Config Table
columns:
  - { key: "id", label: "ID", type: "number", readonly: true, width: "80px" }
  - { key: "name", label: "Potion Name", type: "string", width: "150px" }
  - { key: "effect", label: "Effect Type", type: "select", width: "120px", options: [{ value: "heal", label: "Heal" }, { value: "mana", label: "Mana" }, { value: "buff", label: "Buff" }] }
  - { key: "value", label: "Effect Value", type: "number", min: 1, max: 9999, step: 10, width: "100px" }
  - { key: "price", label: "Price", type: "number", min: 0, max: 9999, step: 5, width: "100px" }
  - { key: "stackable", label: "Stackable", type: "boolean", width: "80px" }
```

## Instructions

- **ID Column**: Read-only, cannot be modified
- **Name Column**: Text input
- **Numeric Columns**: Number input with range constraints
- **Stackable Column**: Checkbox, click to toggle
- **Effect Type**: Dropdown selection
