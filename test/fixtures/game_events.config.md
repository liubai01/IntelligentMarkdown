# Game Event System Configuration

This document manages core event callback functions in the game. Each event can be edited directly in VS Code; click "Save" to apply changes to the source file.

## Event System Settings

### Enable Logging

```lua-config
file: ./game_events.lua
key: GameEvents.Settings.EnableLog
type: boolean
label: Event Logging Toggle
```

### Max Retries

```lua-config
file: ./game_events.lua
key: GameEvents.Settings.MaxRetries
type: number
min: 1
max: 10
step: 1
label: Max Retries
```

### Event Queue Size

```lua-config
file: ./game_events.lua
key: GameEvents.Settings.EventQueueSize
type: slider
min: 64
max: 1024
step: 64
label: Event Queue Size
```

## Event Handler Functions

> Each event function below can be edited directly in VS Code with full syntax highlighting, IntelliSense, and navigation support.

### Player Death Callback

> Design note: Players have a chance to drop items on death, and a respawn timer starts. Adjust the `dropRate` variable to change drop probability.

```lua-config
file: ./game_events.lua
key: GameEvents.onPlayerDeath
type: code
label: Player Death Event
```

### Player Level Up Callback

> Design note: On level up, HP and MP are fully restored, and new skills are unlocked based on level. Configure skill unlock levels in the `skillUnlocks` table.

```lua-config
file: ./game_events.lua
key: GameEvents.onPlayerLevelUp
type: code
label: Player Level Up Event
```

### Monster Kill Callback

> Design note: Killing monsters grants experience and gold rewards. Bosses have additional loot drops. Experience calculation is affected by the player's exp bonus.

```lua-config
file: ./game_events.lua
key: GameEvents.onMonsterKilled
type: code
label: Monster Kill Event
```

## Instructions

- **Event Logging**: When enabled, event trigger logs are output to the console for debugging
- **Edit Functions**: Click the code block to edit the function directly
- **Apply Changes**: After editing, click "💾 Save" to write changes back to the source file
- **Jump to Source**: Click the 📍 button to navigate to the corresponding location in the Lua source file
