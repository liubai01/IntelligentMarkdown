# slua Unreal Actor Prompt Wizard

Use this fixture to generate a high-quality Cursor prompt for implementing an slua-unreal actor script similar in style to Map2Actor.

Reference style:

- https://github.com/Tencent/sluaunreal/blob/master/Content/Lua/Map2Actor.lua

```lua-wizard
file: ../slua/slua-game-state.lua
action: prompt
label: Generate slua Unreal Actor Prompt
icon: 🎯
prompt: |
  You are an expert in slua-unreal Lua gameplay scripting.

  Please implement a reusable gameplay actor script based on the following design inputs:

  - Actor name: {{actorName}}
  - Actor category: {{actorCategory}}
  - Primary gameplay role: {{gameplayRole}}
  - Blueprint class path for spawning (optional): {{bpClassPath}}
  - Lifecycle hooks to include: {{lifecycleHooks}}
  - Movement model: {{movementModel}}
  - Targeting or interaction model: {{interactionModel}}
  - Spawn strategy: {{spawnStrategy}}
  - Replication mode: {{replicationMode}}
  - Core gameplay tags/modules: {{gameplayModules}}
  - User custom requirements: {{userPrompt}}

  Constraints:
  1) Follow the coding style of Map2Actor.lua:
     - ReceiveBeginPlay / ReceiveEndPlay / Tick lifecycle
     - import(...) usage for Unreal symbols
     - return Class(nil, nil, <ActorTable>)
  2) Build a generic actor architecture, not a hard-coded demo.
     - Keep spawn logic pluggable via strategy branches:
       none / single / pooled / wave / external-managed.
     - Keep movement and interaction logic modular and replaceable.
  3) Keep comments concise and practical.
  4) Ensure the script is directly runnable in slua-unreal context.
  5) Output only Lua code, no extra explanation.

  Additionally:
  - Include robust nil checks where reasonable.
  - Keep function/variable names clear and game-dev friendly.
  - Expose key tunables in one config table near the top of the file.
  - Prefer gameplay-oriented helper methods (init, spawn, update, cleanup).

steps:
  - field: actorName
    label: Actor Name
    type: string
    default: GenericGameplayActor
  - field: actorCategory
    label: Actor Category
    type: select
    options:
      - { value: "npc", label: "NPC / Character" }
      - { value: "projectile", label: "Projectile" }
      - { value: "interactive", label: "Interactive Object" }
      - { value: "controller", label: "Gameplay Controller" }
      - { value: "spawner", label: "Spawner / Director" }
    default: npc
  - field: gameplayRole
    label: Primary Gameplay Role
    type: string
    default: Patrol and react to player interactions
  - field: bpClassPath
    label: Blueprint Class Path (Optional)
    type: string
    default: /Game/TestActor.TestActor_C
  - field: lifecycleHooks
    label: Lifecycle Hooks
    type: string
    default: ReceiveBeginPlay, Tick, ReceiveEndPlay
  - field: movementModel
    label: Movement Model
    type: select
    options:
      - { value: "none", label: "Static / No Movement" }
      - { value: "patrol", label: "Patrol Points" }
      - { value: "seek", label: "Seek Target" }
      - { value: "orbit", label: "Orbit Motion" }
      - { value: "custom-curve", label: "Custom Curve Motion" }
    default: patrol
  - field: interactionModel
    label: Interaction Model
    type: select
    options:
      - { value: "none", label: "No Interaction" }
      - { value: "overlap-trigger", label: "Overlap Trigger" }
      - { value: "damageable", label: "Damageable" }
      - { value: "talkable", label: "Talkable / Quest" }
      - { value: "collectible", label: "Collectible" }
    default: overlap-trigger
  - field: spawnStrategy
    label: Spawn Strategy
    type: select
    options:
      - { value: "none", label: "No Internal Spawn" }
      - { value: "single", label: "Single Spawn" }
      - { value: "pooled", label: "Object Pool Spawn" }
      - { value: "wave", label: "Wave Spawn" }
      - { value: "external-managed", label: "Managed by External System" }
    default: external-managed
  - field: replicationMode
    label: Replication Mode
    type: select
    options:
      - { value: "standalone", label: "Standalone / Local" }
      - { value: "server-authoritative", label: "Server Authoritative" }
      - { value: "client-predicted", label: "Client Predicted" }
    default: server-authoritative
  - field: gameplayModules
    label: Gameplay Modules (comma-separated)
    type: string
    default: movement, target-selection, state-machine, cooldown, debug-log
  - field: userPrompt
    label: Extra Requirements from User
    type: string
    default: Add clear extension points for AI logic and custom abilities.
```

