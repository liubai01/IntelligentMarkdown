# Factorio Material Designer Prompt Fixture

This fixture is a **designer-friendly** wizard for creating a new material concept.

Design principles:

- Wizard steps use product/design language (not technical schema terms)
- Prompt output remains strict and production-oriented
- AI output is constrained to markdown patch snippets for config blocks
- Final artifact is a ready-to-use Lua prototype script for `data.lua`

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
key: Mod.Items
markdown-key: item-model
type: table
label: Item Data Model
columns:
  - { key: "name", label: "Name", type: "string", width: "200px" }
  - { key: "type", label: "Type", type: "select", width: "140px",
      options: [{ value: "item", label: "Item" }, { value: "fluid", label: "Fluid" }] }
  - { key: "stack_size", label: "Stack", type: "number", min: 1, max: 1000, width: "100px" }
  - { key: "tier", label: "Tier", type: "number", min: 1, max: 10, width: "90px" }
value:
  - { name: "compressed-iron-plate", type: "item", stack_size: 200, tier: 2 }
  - { name: "high-density-copper-cable", type: "item", stack_size: 400, tier: 2 }
  - { name: "thermal-mesh-alloy", type: "item", stack_size: 150, tier: 3 }
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
  - { name: "thermal-mesh-alloy", category: "crafting-with-fluid", energy_required: 4.0, enabled: false }
```

```lua-config
storage: markdown
key: Mod.Output.DataLua
markdown-key: factorio-data-lua
type: code
label: Factorio data.lua Script Output
value: |
  markdown-key: factorio-data-lua
  value: |
    -- Heat-resistant composite for mid-game logistics throughput.
    data:extend({
      {
        type = "item",
        name = "ceramic-fiber-composite",
        icon = "__base__/graphics/icons/steel-plate.png",
        icon_size = 64,
        subgroup = "intermediate-product",
        order = "c[advanced-material]-c[ceramic-fiber-composite]",
        stack_size = 150
      },
      {
        type = "recipe",
        name = "ceramic-fiber-composite",
        category = "crafting-with-fluid",
        enabled = false,
        energy_required = 4.0,
        ingredients = {
          { type = "item", name = "thermal-mesh-alloy", amount = 2 },
          { type = "item", name = "steel-plate", amount = 2 },
          { type = "fluid", name = "lubricant", amount = 20 }
        },
        results = {
          { type = "item", name = "ceramic-fiber-composite", amount = 2 }
        }
      }
    })
```

```lua-wizard
file: ../lua-config/items_config.lua
action: prompt
label: Design New Material (Designer Mode)
icon: 🎨
prompt: |
  You are a senior game economy and systems designer.

  Goal:
  Design ONE new material for a Factorio-like mod and integrate it into progression.

  Context:
  - Mod name: {{modName}}
  - Material fantasy/theme: {{materialFantasy}}
  - Progression stage: {{progressionStage}}
  - Player acquire loop: {{acquireLoop}}
  - Economy goal: {{economyGoal}}
  - Balance direction: {{balanceDirection}}
  - Design risk preference: {{riskPreference}}

  Existing models:
  - Item model: {{itemModel}}
  - Recipe model: {{recipeModel}}

  Required output:
  1) Lua prototype script that can be copied into Factorio `data.lua`.
  2) Script must include:
     - `data:extend({...})`
     - one new item prototype
     - one new recipe prototype
     - comments for maintainability (concise)
  3) Keep names and balance aligned with the provided item/recipe models.

  Output constraints:
  - Read the `@file ...` line at the top of this prompt as the target markdown file.
  - Your output is intended to be pasted back into that markdown file.
  - Do NOT output explanations, analysis, markdown prose, or extra wrappers.
  - Return ONLY a markdown patch snippet targeting:
      markdown-key: factorio-data-lua
      value: |
        <Lua script here>
  - The script must be directly usable in `data.lua`.
  - No explanations outside the requested output.
  - Keep this envelope exactly:
      markdown-key: factorio-data-lua
      value: |
        -- Lua code only

variables:
  modName:
    type: config
    markdown-key: mod-name
  itemModel:
    type: config
    markdown-key: item-model
  recipeModel:
    type: config
    markdown-key: recipe-model

steps:
  - field: materialFantasy
    label: Material Theme (what it feels like)
    type: string
    default: Heat-resistant composite alloy for late-mid logistics.
  - field: progressionStage
    label: Progression Stage
    type: select
    options:
      - { value: "early", label: "Early Game" }
      - { value: "mid", label: "Mid Game" }
      - { value: "late", label: "Late Game" }
    default: mid
  - field: acquireLoop
    label: How players obtain it
    type: select
    options:
      - { value: "mining", label: "Mining + basic processing" }
      - { value: "refining", label: "Refining chain" }
      - { value: "chemical", label: "Chemical production" }
      - { value: "hybrid", label: "Hybrid multi-step" }
    default: hybrid
  - field: economyGoal
    label: Economy Goal
    type: select
    options:
      - { value: "bottleneck", label: "Intentional bottleneck" }
      - { value: "throughput", label: "Boost throughput" }
      - { value: "sink", label: "Resource sink" }
      - { value: "stability", label: "Stability and consistency" }
    default: throughput
  - field: balanceDirection
    label: Balance Direction
    type: select
    options:
      - { value: "vanilla-plus", label: "Vanilla+" }
      - { value: "hardcore", label: "Hardcore economy" }
      - { value: "casual", label: "Casual friendly" }
    default: vanilla-plus
  - field: riskPreference
    label: Design Risk Preference
    type: select
    options:
      - { value: "conservative", label: "Conservative" }
      - { value: "balanced", label: "Balanced" }
      - { value: "experimental", label: "Experimental" }
    default: balanced
  - field: confirm
    label: I confirm this is for designer-facing iteration
    type: boolean
    default: true
```

