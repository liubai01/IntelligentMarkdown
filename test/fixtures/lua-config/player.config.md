# Player Stats Configuration

This document configures the player's base attributes. Changes are automatically synced to Lua code.

## Base Stats

### Health Points

> Design note: Initial HP should not exceed 10000, as it may affect game balance.

```lua-config
file: ./player_config.lua
key: PlayerConfig.BaseStats.HP
type: number
min: 100
max: 10000
step: 100
label: Base HP
```

### Mana Points

```lua-config
file: ./player_config.lua
key: PlayerConfig.BaseStats.MP
type: number
min: 0
max: 5000
step: 50
label: Base MP
```

### Attack Power

```lua-config
file: ./player_config.lua
key: PlayerConfig.BaseStats.Attack
type: slider
range: [10, 500]
step: 5
label: Base Attack
```

### Movement Speed

```lua-config
file: ./player_config.lua
key: PlayerConfig.BaseStats.MoveSpeed
type: slider
range: [100, 500]
step: 10
label: Base Move Speed
unit: units/sec
```

## Skill Configuration

### Default Skill ID

```lua-config
file: ./player_config.lua
key: PlayerConfig.Skills.DefaultSkillId
type: number
label: Default Skill ID
```

## Game Settings

### Show Tutorial

```lua-config
file: ./player_config.lua
key: PlayerConfig.Settings.ShowTutorial
type: boolean
label: Tutorial Toggle
```

### Game Language

```lua-config
file: ./player_config.lua
key: PlayerConfig.Settings.Language
type: select
options:
  - { value: "zh-CN", label: "Chinese (Simplified)" }
  - { value: "en-US", label: "English" }
  - { value: "ja-JP", label: "Japanese" }
label: Game Language
```

### Game Difficulty

```lua-config
file: ./player_config.lua
key: PlayerConfig.Settings.Difficulty
type: select
options:
  - { value: "easy", label: "Easy" }
  - { value: "normal", label: "Normal" }
  - { value: "hard", label: "Hard" }
label: Game Difficulty
```
