# Economy Patch Prompt Fixture

This fixture represents a real-world game economy patch review flow.

- Uses config values from markdown-local blocks and source-linked blocks
- Generates a production-ready AI prompt for balancing and risk checks
- Demonstrates default key reference (`path`) + explicit `markdown-key`

```lua-config
storage: markdown
key: Economy.TargetDAU
type: number
label: Target DAU
min: 1000
max: 5000000
step: 1000
value: 250000
```

```lua-config
storage: markdown
key: Economy.ARPPUTarget
markdown-key: arppu-target
type: number
label: ARPPU Target (USD)
min: 1
max: 500
step: 1
value: 28
```

```lua-config
storage: markdown
key: Economy.EventDurationDays
type: number
label: Event Duration (Days)
min: 1
max: 60
step: 1
value: 14
```

```lua-config
file: ../lua-config/items_config.lua
key: ItemsConfig.MaxUpgradeLevel
markdown-key: max-upgrade-level
type: number
label: Max Upgrade Level
min: 1
max: 30
step: 1
```

```lua-wizard
file: ../lua-config/items_config.lua
action: prompt
label: Generate Economy Patch Risk Prompt
icon: 💰
prompt: |
  You are a senior game economy designer reviewing a live patch.

  Patch context:
  - Target DAU: {{targetDAU}}
  - ARPPU Target: ${{arppu}}
  - Event Duration: {{durationDays}} days
  - Max Upgrade Level: {{maxUpgrade}}
  - Patch theme: {{patchTheme}}
  - Monetization strategy: {{monetizationMode}}

  Please provide:
  1) Economy impact forecast (resource sink/source balance).
  2) Payer vs non-payer impact analysis and fairness risks.
  3) 3 high-risk exploit vectors and prevention suggestions.
  4) KPI monitoring plan for D1/D3/D7.
  5) Rollback trigger recommendations for economy anomalies.

  Output format:
  - concise markdown
  - include explicit KPI thresholds where possible

variables:
  targetDAU:
    type: config
    path: Economy.TargetDAU
  arppu:
    type: config
    markdown-key: arppu-target
  durationDays:
    type: config
    path: Economy.EventDurationDays
  maxUpgrade:
    type: config
    markdown-key: max-upgrade-level

steps:
  - field: patchTheme
    label: Patch Theme
    type: string
    default: Lunar Festival progression boost
  - field: monetizationMode
    label: Monetization Strategy
    type: select
    options:
      - { value: "cosmetic-heavy", label: "Cosmetic Heavy" }
      - { value: "progression-heavy", label: "Progression Heavy" }
      - { value: "hybrid", label: "Hybrid" }
    default: hybrid
  - field: confirm
    label: I confirm data is aligned with latest economy sheet
    type: boolean
    default: true
```

