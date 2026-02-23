# Items Configuration

This file manages in-game item configurations.

## Weapons

Configure weapon attributes below:

```lua-config
file: ../lua-config/items_config.lua
key: ItemsConfig.Weapons[1].attack
type: slider
label: Wooden Sword Attack
min: 1
max: 100
```

```lua-config
file: ../lua-config/items_config.lua
key: ItemsConfig.Weapons[2].attack
type: slider
label: Iron Sword Attack
min: 1
max: 200
```

### Create New Weapon

Use the wizard below to create a new weapon and add it to the weapons list:

```lua-wizard
file: ../lua-config/items_config.lua
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
    default: 1005
    description: Unique weapon identifier (must be > 1000)
    min: 1001
  - field: name
    label: Weapon Name
    type: string
    default: New Weapon
    description: Display name shown in game
  - field: attack
    label: Attack Power
    type: number
    default: 50
    min: 1
    max: 999
    description: Base attack damage value
  - field: price
    label: Price (Gold)
    type: number
    default: 100
    min: 0
    description: Purchase price in gold coins
  - field: stackable
    label: Stackable
    type: boolean
    default: false
    description: Whether multiple copies can stack in inventory
```

## Potions

```lua-config
file: ../lua-config/items_config.lua
key: ItemsConfig.Potions
type: table
label: Potion List
columns:
  - key: id
    label: ID
    type: number
    readonly: true
  - key: name
    label: Name
    type: string
  - key: effect
    label: Effect
    type: string
  - key: value
    label: Value
    type: number
    min: 1
  - key: price
    label: Price
    type: number
    min: 1
  - key: stackable
    label: Stackable
    type: boolean
```
