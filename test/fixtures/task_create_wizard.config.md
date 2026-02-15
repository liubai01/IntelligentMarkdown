# Task Configuration Manager

This wizard helps you create and manage game tasks. Choose a task type below to get started.

## Current Tasks Overview

### Main Story Tasks

```lua-config
file: ./tasks_config.lua
key: TasksConfig.MainTasks
type: table
label: Main Story Tasks
columns:
  - { key: "id", label: "ID", type: "number", readonly: true, width: "60px" }
  - { key: "name", label: "Task Name", type: "string", width: "140px" }
  - { key: "description", label: "Description", type: "string", width: "200px" }
  - { key: "type", label: "Type", type: "string", width: "80px" }
  - { key: "required_level", label: "Req Lv", type: "number", min: 1, width: "70px" }
  - { key: "reward_exp", label: "EXP", type: "number", min: 0, width: "80px" }
  - { key: "reward_gold", label: "Gold", type: "number", min: 0, width: "80px" }
  - { key: "repeatable", label: "Repeat", type: "boolean", width: "70px" }
```

### Daily Tasks

```lua-config
file: ./tasks_config.lua
key: TasksConfig.DailyTasks
type: table
label: Daily Tasks
columns:
  - { key: "id", label: "ID", type: "number", readonly: true, width: "60px" }
  - { key: "name", label: "Task Name", type: "string", width: "140px" }
  - { key: "description", label: "Description", type: "string", width: "200px" }
  - { key: "type", label: "Type", type: "string", width: "80px" }
  - { key: "required_level", label: "Req Lv", type: "number", min: 1, width: "70px" }
  - { key: "reward_exp", label: "EXP", type: "number", min: 0, width: "80px" }
  - { key: "reward_gold", label: "Gold", type: "number", min: 0, width: "80px" }
  - { key: "time_limit", label: "Time(s)", type: "number", min: 0, width: "80px" }
  - { key: "repeatable", label: "Repeat", type: "boolean", width: "70px" }
```

---

## Create New Main Story Task

> Use this wizard to create a new main story task and insert it into the configuration file.

```lua-wizard
file: ./tasks_config.lua
target: TasksConfig.MainTasks
action: append
label: Create Main Story Task
icon: 📜
template: |
  { id = {{id}}, name = "{{name}}", description = "{{description}}", type = "story", required_level = {{required_level}}, reward_exp = {{reward_exp}}, reward_gold = {{reward_gold}}, time_limit = 0, repeatable = false }
steps:
  - field: id
    label: Task ID
    type: number
    default: 104
    description: "Unique task identifier (main tasks: 100-199)"
    min: 100
    max: 199
  - field: name
    label: Task Name
    type: string
    default: "New Story Task"
    description: Display name shown to the player
  - field: description
    label: Task Description
    type: string
    default: "A new adventure awaits"
    description: Brief description of the task objective
  - field: required_level
    label: Required Level
    type: number
    default: 1
    min: 1
    max: 100
    description: Minimum player level to accept this task
  - field: reward_exp
    label: Reward EXP
    type: number
    default: 200
    min: 0
    max: 99999
    description: Experience points awarded on completion
  - field: reward_gold
    label: Reward Gold
    type: number
    default: 100
    min: 0
    max: 99999
    description: Gold coins awarded on completion
```

## Create New Daily Task

> Use this wizard to create a new daily task with time limit and repeat settings.

```lua-wizard
file: ./tasks_config.lua
target: TasksConfig.DailyTasks
action: append
label: Create Daily Task
icon: 🔄
template: |
  { id = {{id}}, name = "{{name}}", description = "{{description}}", type = "{{task_type}}", required_level = {{required_level}}, reward_exp = {{reward_exp}}, reward_gold = {{reward_gold}}, time_limit = {{time_limit}}, repeatable = true }
steps:
  - field: id
    label: Task ID
    type: number
    default: 204
    description: "Unique task identifier (daily tasks: 200-299)"
    min: 200
    max: 299
  - field: name
    label: Task Name
    type: string
    default: "New Daily Task"
    description: Display name shown to the player
  - field: description
    label: Task Description
    type: string
    default: "Complete this daily challenge"
    description: Brief description of the task objective
  - field: task_type
    label: Task Type
    type: select
    default: gather
    description: Category of the task
    options:
      - { value: "gather", label: "🌿 Gather" }
      - { value: "combat", label: "⚔️ Combat" }
      - { value: "delivery", label: "📦 Delivery" }
      - { value: "explore", label: "🗺️ Explore" }
      - { value: "craft", label: "🔨 Craft" }
  - field: required_level
    label: Required Level
    type: number
    default: 1
    min: 1
    max: 100
    description: Minimum player level to accept this task
  - field: reward_exp
    label: Reward EXP
    type: number
    default: 60
    min: 0
    max: 9999
    description: Experience points awarded on completion
  - field: reward_gold
    label: Reward Gold
    type: number
    default: 50
    min: 0
    max: 9999
    description: Gold coins awarded on completion
  - field: time_limit
    label: Time Limit (seconds)
    type: number
    default: 3600
    min: 0
    max: 86400
    step: 300
    description: "Time limit in seconds (0 = no limit, 3600 = 1 hour)"
```

## Task System Settings

```lua-config
file: ./tasks_config.lua
key: TasksConfig.Settings.MaxActiveTasks
type: slider
min: 1
max: 20
step: 1
label: Max Active Tasks
```

```lua-config
file: ./tasks_config.lua
key: TasksConfig.Settings.DailyTaskRefreshHour
type: number
min: 0
max: 23
label: Daily Task Refresh Hour (0-23)
```

```lua-config
file: ./tasks_config.lua
key: TasksConfig.Settings.TaskExpMultiplier
type: number
min: 0.1
max: 10.0
step: 0.1
label: Task EXP Multiplier
```
