# Factorio-style Item & Recipe Model Prompt Fixture

This fixture targets game mod development workflows with a Factorio-like data model.

It demonstrates:

- Defining mod parameters in `lua-config` blocks
- Using table-based item/recipe model inputs
- Referencing config values from `lua-wizard` via `type: config`
- Generating production-oriented AI prompts for `data.lua` design and balancing

```lua-config
storage: markdown
key: Mod.Meta.Name
markdown-key: mod-name
type: string
label: Mod Name
value: logistics_overhaul_plus
```

```lua-config
storage: markdown
key: Mod.Meta.TargetGameVersion
markdown-key: target-version
type: string
label: Target Game Version
value: "2.0"
```

```lua-config
storage: markdown
key: Mod.Meta.TierCount
markdown-key: tier-count
type: number
label: Item Tier Count
min: 1
max: 10
step: 1
value: 4
```

```lua-config
storage: markdown
key: Mod.Items
markdown-key: item-model
type: table
label: Item Data Model
columns:
  - { key: "name", label: "Name", type: "string", width: "180px" }
  - { key: "type", label: "Type", type: "select", width: "140px",
      options: [{ value: "item", label: "Item" }, { value: "fluid", label: "Fluid" }] }
  - { key: "stack_size", label: "Stack", type: "number", min: 1, max: 1000, width: "100px" }
  - { key: "tier", label: "Tier", type: "number", min: 1, max: 10, width: "90px" }
value:
  - { name: "compressed-iron-plate", type: "item", stack_size: 200, tier: 2 }
  - { name: "high-density-copper-cable", type: "item", stack_size: 400, tier: 2 }
  - { name: "advanced-lubricant", type: "fluid", stack_size: 1, tier: 3 }
```

```lua-config
storage: markdown
key: Mod.Recipes
markdown-key: recipe-model
type: table
label: Recipe Data Model
columns:
  - { key: "name", label: "Recipe Name", type: "string", width: "220px" }
  - { key: "category", label: "Category", type: "string", width: "140px" }
  - { key: "energy_required", label: "Time (s)", type: "number", min: 0.1, max: 120, step: 0.1, width: "110px" }
  - { key: "enabled", label: "Enabled", type: "boolean", width: "90px" }
value:
  - { name: "compressed-iron-plate", category: "crafting", energy_required: 2.0, enabled: false }
  - { name: "high-density-copper-cable", category: "crafting", energy_required: 1.5, enabled: false }
  - { name: "advanced-lubricant", category: "chemistry", energy_required: 6.0, enabled: false }
```

```lua-wizard
file: ../lua-config/items_config.lua
action: prompt
label: Generate Factorio-style Item/Recipe Mod Prompt
icon: 🏭
prompt: |
  You are an experienced game mod engineer focused on Factorio-like prototype data modeling.

  Mod context:
  - Mod name: {{modName}}
  - Target game version: {{targetVersion}}
  - Tier count: {{tierCount}}
  - Balance strategy: {{balanceStrategy}}
  - Tech progression style: {{techStyle}}
  - Compatibility mode: {{compatMode}}

  Item model (input table): {{itemModel}}
  Recipe model (input table): {{recipeModel}}

  Please produce:
  1) Updated item rows for `markdown-key: item-model`.
  2) Updated recipe rows for `markdown-key: recipe-model`.
  3) Balancing adjustments (cost curves, tier scaling, crafting time heuristics) reflected directly in those rows.
  4) Tech unlock and compatibility notes as short comments (if needed), but do not output game script files.

  Constraints:
  - Be production-oriented for real mod iteration.
  - Prefer deterministic naming and schema consistency.
  - Read the `@file ...` line at the top of this prompt as the target markdown file.
  - Your output is intended to be pasted back into that markdown file.
  - Do NOT generate `data.lua`, `control.lua`, or any script file content.
  - Return ONLY markdown-ready YAML snippets for these two blocks:
    - markdown-key: item-model
    - markdown-key: recipe-model
  - Keep existing columns unchanged; only update `value` rows.
  - No explanations, no analysis, no extra prose.
  - Output format:
      markdown-key: item-model
      value:
        - { ... }
      markdown-key: recipe-model
      value:
        - { ... }

variables:
  modName:
    type: config
    markdown-key: mod-name
  targetVersion:
    type: config
    markdown-key: target-version
  tierCount:
    type: config
    markdown-key: tier-count
  itemModel:
    type: config
    markdown-key: item-model
  recipeModel:
    type: config
    markdown-key: recipe-model

steps:
  - field: balanceStrategy
    label: Balance Strategy
    type: select
    options:
      - { value: "vanilla-plus", label: "Vanilla+" }
      - { value: "hardcore", label: "Hardcore Economy" }
      - { value: "casual", label: "Casual Friendly" }
    default: vanilla-plus
  - field: techStyle
    label: Tech Progression Style
    type: select
    options:
      - { value: "linear", label: "Linear" }
      - { value: "branching", label: "Branching" }
      - { value: "hybrid", label: "Hybrid" }
    default: hybrid
  - field: compatMode
    label: Compatibility Mode
    type: select
    options:
      - { value: "strict", label: "Strict (Fail Fast)" }
      - { value: "soft", label: "Soft Compatibility" }
      - { value: "auto-patch", label: "Auto Patch" }
    default: soft
  - field: confirm
    label: I confirm this prompt is for mod production planning
    type: boolean
    default: true
```

