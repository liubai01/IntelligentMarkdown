# 游戏事件系统配置

本文档管理游戏中的核心事件回调函数。每个事件可以在 VS Code 中直接编辑，编辑完成后点击 "Apply" 即可应用到源文件。

## 事件系统设置

### 启用日志

```lua-config
file: ./game_events.lua
key: GameEvents.Settings.EnableLog
type: boolean
label: 事件日志开关
```

### 最大重试次数

```lua-config
file: ./game_events.lua
key: GameEvents.Settings.MaxRetries
type: number
min: 1
max: 10
step: 1
label: 最大重试次数
```

### 事件队列大小

```lua-config
file: ./game_events.lua
key: GameEvents.Settings.EventQueueSize
type: slider
min: 64
max: 1024
step: 64
label: 事件队列大小
```

## 事件处理函数

> 以下每个事件函数都可以直接在 VS Code 中编辑，享受完整的语法高亮、IntelliSense 和跳转功能。

### 玩家死亡回调

> 策划备注：玩家死亡后会有概率掉落物品，并启动复活计时器。修改掉落率请调整 `dropRate` 变量。

```lua-config
file: ./game_events.lua
key: GameEvents.onPlayerDeath
type: code
label: 玩家死亡事件
```

### 玩家升级回调

> 策划备注：升级时会恢复满血满蓝，并根据等级解锁新技能。可在 `skillUnlocks` 表中配置技能解锁等级。

```lua-config
file: ./game_events.lua
key: GameEvents.onPlayerLevelUp
type: code
label: 玩家升级事件
```

### 怪物击杀回调

> 策划备注：击杀怪物发放经验和金币奖励，Boss 有额外掉落。经验计算受玩家经验加成影响。

```lua-config
file: ./game_events.lua
key: GameEvents.onMonsterKilled
type: code
label: 怪物击杀事件
```

## 使用说明

- **事件日志**：开启后会在控制台输出事件触发日志，便于调试
- **编辑函数**：点击 "✏️ Edit in VS Code" 会在 VS Code 原生编辑器中打开函数代码
- **应用更改**：编辑完成后点击 "💾 Apply to Source" 将修改写回源文件
- **跳转源码**：点击 📍 按钮可以直接跳转到 Lua 源文件对应位置
