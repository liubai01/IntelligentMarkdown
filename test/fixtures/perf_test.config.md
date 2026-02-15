# Performance Test — Large Dataset

This configuration tests rendering performance with multiple large tables and various control types.

## Global Settings

```lua-config
file: ./perf_test_config.lua
key: PerfTestConfig.Settings.MaxLevel
type: slider
min: 1
max: 100
step: 1
label: Max Level Cap
```

```lua-config
file: ./perf_test_config.lua
key: PerfTestConfig.Settings.ExpMultiplier
type: number
min: 0.1
max: 10.0
step: 0.1
label: EXP Multiplier
```

```lua-config
file: ./perf_test_config.lua
key: PerfTestConfig.Settings.GoldDropRate
type: number
min: 0.0
max: 1.0
step: 0.01
label: Gold Drop Rate
```

```lua-config
file: ./perf_test_config.lua
key: PerfTestConfig.Settings.EnablePvP
type: boolean
label: Enable PvP
```

```lua-config
file: ./perf_test_config.lua
key: PerfTestConfig.Settings.DifficultyScale
type: slider
min: 0.5
max: 3.0
step: 0.1
label: Difficulty Scale
```

---

## NPC Database (30 entries)

> Large table with multiple columns and data types.

```lua-config
file: ./perf_test_config.lua
key: PerfTestConfig.NPCs
type: table
label: NPC Database
columns:
  - { key: "id", label: "ID", type: "number", readonly: true, width: "50px" }
  - { key: "name", label: "Name", type: "string", width: "140px" }
  - { key: "level", label: "Lv", type: "number", min: 1, max: 100, width: "60px" }
  - { key: "hp", label: "HP", type: "number", min: 1, width: "80px" }
  - { key: "attack", label: "ATK", type: "number", min: 0, width: "70px" }
  - { key: "defense", label: "DEF", type: "number", min: 0, width: "70px" }
  - { key: "speed", label: "SPD", type: "number", min: 0, width: "60px" }
  - { key: "faction", label: "Faction", type: "string", width: "90px" }
  - { key: "is_boss", label: "Boss", type: "boolean", width: "60px" }
```

---

## Skills Database (30 entries)

> Another large table with different column structure.

```lua-config
file: ./perf_test_config.lua
key: PerfTestConfig.Skills
type: table
label: Skills Database
columns:
  - { key: "id", label: "ID", type: "number", readonly: true, width: "60px" }
  - { key: "name", label: "Skill Name", type: "string", width: "140px" }
  - { key: "element", label: "Element", type: "string", width: "80px" }
  - { key: "damage", label: "DMG", type: "number", width: "70px" }
  - { key: "mana_cost", label: "Mana", type: "number", min: 0, width: "70px" }
  - { key: "cooldown", label: "CD(s)", type: "number", min: 0, width: "60px" }
  - { key: "aoe", label: "AoE", type: "boolean", width: "60px" }
  - { key: "level_req", label: "Req Lv", type: "number", min: 1, width: "70px" }
```

---

## Equipment Database (20 entries)

> Third large table testing additional load.

```lua-config
file: ./perf_test_config.lua
key: PerfTestConfig.Equipment
type: table
label: Equipment Database
columns:
  - { key: "id", label: "ID", type: "number", readonly: true, width: "60px" }
  - { key: "name", label: "Equipment", type: "string", width: "160px" }
  - { key: "slot", label: "Slot", type: "string", width: "80px" }
  - { key: "armor", label: "Armor", type: "number", min: 0, width: "70px" }
  - { key: "bonus_hp", label: "+HP", type: "number", min: 0, width: "70px" }
  - { key: "bonus_atk", label: "+ATK", type: "number", min: 0, width: "70px" }
  - { key: "rarity", label: "Rarity", type: "string", width: "90px" }
  - { key: "level_req", label: "Req Lv", type: "number", min: 1, width: "70px" }
```
