# JSON Variables Wizard Fixture

This fixture demonstrates `lua-wizard` run mode with JSON-backed variables.

```lua-wizard
file: ./game_json_config.json
action: run
label: Validate JSON Config
icon: 🧪
cwd: .
variables:
  playerName:
    type: json
    file: ./game_json_config.json
    path: GameConfig.Player.Name
  playerHp:
    type: json
    file: ./game_json_config.json
    path: GameConfig.Player.MaxHealth
commands: |
  echo Player={{playerName}}
  echo HP={{playerHp}}
steps:
  - field: confirm
    label: Confirm fixture execution
    type: boolean
    default: false
```
