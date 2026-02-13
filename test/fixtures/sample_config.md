# 玩家属性配置文档

本文档用于配置玩家的基础属性，修改后会自动同步到 Lua 代码。

## 基础属性

### 生命值

> 策划备注：初始生命值不要超过 10000，否则会影响游戏平衡。

```lua-config
file: ./player_config.lua
key: PlayerConfig.BaseStats.HP
type: number
min: 100
max: 10000
step: 100
label: 基础生命值
```

### 魔法值

```lua-config
file: ./player_config.lua
key: PlayerConfig.BaseStats.MP
type: number
min: 0
max: 5000
step: 50
label: 基础魔法值
```

### 攻击力

```lua-config
file: ./player_config.lua
key: PlayerConfig.BaseStats.Attack
type: slider
range: [10, 500]
step: 5
label: 基础攻击力
```

### 移动速度

```lua-config
file: ./player_config.lua
key: PlayerConfig.BaseStats.MoveSpeed
type: slider
range: [100, 500]
step: 10
label: 基础移动速度
unit: 单位/秒
```

## 技能配置

### 默认技能 ID

```lua-config
file: ./player_config.lua
key: PlayerConfig.Skills.DefaultSkillId
type: number
label: 出生默认技能 ID
```

## 游戏设置

### 是否显示新手引导

```lua-config
file: ./player_config.lua
key: PlayerConfig.Settings.ShowTutorial
type: boolean
label: 新手引导开关
```

### 游戏语言

```lua-config
file: ./player_config.lua
key: PlayerConfig.Settings.Language
type: select
options:
  - { value: "zh-CN", label: "简体中文" }
  - { value: "en-US", label: "English" }
  - { value: "ja-JP", label: "日本語" }
label: 游戏语言
```

### 游戏难度

```lua-config
file: ./player_config.lua
key: PlayerConfig.Settings.Difficulty
type: select
options:
  - { value: "easy", label: "简单" }
  - { value: "normal", label: "普通" }
  - { value: "hard", label: "困难" }
label: 游戏难度
```
