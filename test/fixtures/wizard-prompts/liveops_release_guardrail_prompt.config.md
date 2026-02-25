# LiveOps Release Guardrail Prompt Fixture

This fixture models a production-like game release workflow:

- Product / SRE style rollout gate checks
- Gray release strategy and rollback policy
- Prompt generation using `type: config` variables from `lua-config` blocks
- `markdown-key` usage for conflict-safe references

```lua-config
storage: markdown
key: Release.Env
markdown-key: release-env
type: select
label: Target Environment
options:
  - { value: "staging", label: "Staging" }
  - { value: "prod", label: "Production" }
value: prod
```

```lua-config
storage: markdown
key: Release.GrayPercent
markdown-key: gray-percent
type: number
label: Gray Release Percent
min: 1
max: 100
step: 1
value: 20
```

```lua-config
storage: markdown
key: Release.RollbackCrashRate
markdown-key: rollback-crash-rate
type: number
label: Rollback Threshold (Crash Rate %)
min: 0
max: 100
step: 0.1
value: 1.5
```

```lua-config
storage: markdown
key: Release.RollbackP99Ms
markdown-key: rollback-p99-ms
type: number
label: Rollback Threshold (P99 ms)
min: 50
max: 5000
step: 10
value: 450
```

```lua-config
file: ../lua-config/perf_test_config.lua
key: PerfTest.SpawnRate
markdown-key: perf-spawn-rate
type: number
label: Spawn Rate
min: 1
max: 200
step: 1
```

```lua-wizard
file: ../lua-config/perf_test_config.lua
action: prompt
label: Generate LiveOps Release Guardrail Prompt
icon: 🚦
prompt: |
  You are a senior game release commander (LiveOps + SRE).

  Current release context:
  - Environment: {{env}}
  - Gray rollout percent: {{grayPercent}}%
  - Rollback threshold (crash rate): {{rollbackCrashRate}}%
  - Rollback threshold (p99 latency): {{rollbackP99}} ms
  - Current gameplay spawn rate: {{spawnRate}}
  - Business goal: {{businessGoal}}
  - Event risk level: {{riskLevel}}

  Please output:
  1) A go/no-go decision with rationale.
  2) A staged rollout plan (0% -> gray -> full) with explicit stop conditions.
  3) Real-time monitoring checklist (metrics, dashboards, alert thresholds).
  4) Rollback playbook (trigger, owner, timeline, communication template).
  5) Post-release validation checklist for first 2 hours.

  Constraints:
  - Keep it practical for production execution.
  - Use concise markdown bullets and tables.
  - Include concrete threshold values from the context above.

variables:
  env:
    type: config
    markdown-key: release-env
  grayPercent:
    type: config
    markdown-key: gray-percent
  rollbackCrashRate:
    type: config
    markdown-key: rollback-crash-rate
  rollbackP99:
    type: config
    markdown-key: rollback-p99-ms
  spawnRate:
    type: config
    markdown-key: perf-spawn-rate

steps:
  - field: businessGoal
    label: Business Goal
    type: select
    options:
      - { value: "stability-first", label: "Stability First" }
      - { value: "balanced", label: "Balanced Growth + Stability" }
      - { value: "growth-first", label: "Growth First" }
    default: balanced
  - field: riskLevel
    label: Event Risk Level
    type: select
    options:
      - { value: "low", label: "Low" }
      - { value: "medium", label: "Medium" }
      - { value: "high", label: "High" }
    default: medium
  - field: confirm
    label: I confirm this is for production release planning
    type: boolean
    default: true
```

