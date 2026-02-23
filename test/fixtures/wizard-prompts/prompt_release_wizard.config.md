# Prompt Wizard Fixture

This fixture validates the `lua-wizard` prompt workflow.

Expected behavior:

- Fill steps in preview
- Generate a prompt from template variables
- Send/prepare the prompt for Cursor chat execution flow

```lua-wizard
file: ../json-config/game_json_config.json
action: prompt
label: Generate Release Prompt
icon: 🤖
prompt: |
  You are helping with a game release verification.

  Context:
  - Player Name: {{playerName}}
  - Max HP: {{playerHp}}
  - Build Environment: {{env}}

  Tasks:
  1) Check release risk for current config.
  2) Propose 3 validation commands for smoke testing.
  3) Return a short release checklist in markdown.

variables:
  playerName:
    type: json
    file: ../json-config/game_json_config.json
    path: GameConfig.Player.Name
  playerHp:
    type: json
    file: ../json-config/game_json_config.json
    path: GameConfig.Player.MaxHealth

steps:
  - field: env
    label: Target Environment
    type: select
    options:
      - { value: "dev", label: "Development" }
      - { value: "staging", label: "Staging" }
      - { value: "prod", label: "Production" }
    default: staging
  - field: confirm
    label: I want to generate a Cursor prompt
    type: boolean
    default: true
```

