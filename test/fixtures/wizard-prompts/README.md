# Wizard Prompt Fixtures

This folder groups prompt-oriented wizard fixtures used to validate `lua-wizard` with `action: prompt`.

## Included Fixtures

- `prompt_release_wizard.config.md`:
  - Validates JSON-backed prompt variable substitution
  - Uses prompt generation flow for release verification scenarios

- `slua-unreal-actor-prompt.config.md`:
  - Generates a Cursor-ready prompt for creating an slua-unreal actor implementation
  - Supports user-specified requirements and behavior description
  - References the style of Map2Actor-like actor scripts

- `liveops_release_guardrail_prompt.config.md`:
  - Production-like LiveOps release decision workflow (gray rollout + rollback thresholds)
  - Uses `type: config` variables from both markdown-local and source-linked `lua-config` blocks
  - Demonstrates conflict-safe references via `markdown-key`

- `economy_patch_prompt.config.md`:
  - Production economy patch risk-review workflow (DAU/ARPPU/event duration/KPI gates)
  - Uses mixed `type: config` references (`path` + `markdown-key`)
  - Focuses on balance risk, exploit risk, and rollback triggers

- `factorio_item_recipe_model_prompt.config.md`:
  - Mod-dev oriented Factorio-style item + recipe data model workflow
  - Uses table-based `lua-config` models as prompt context (`type: config`)
  - Covers production concerns: balancing, technology unlocks, compatibility, migration safety

- `factorio_material_designer_prompt.config.md`:
  - Designer-friendly Factorio material creation workflow
  - Wizard fields are phrased in product/design language (theme, progression stage, acquire loop, economy goal)
  - Prompt output remains strict: markdown patch snippet for `factorio-data-lua` (ready-to-use Lua for `data.lua`)

