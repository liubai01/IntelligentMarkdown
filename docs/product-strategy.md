# Product Strategy

This document describes the long-term direction of `config.md` as a language-agnostic configuration experience.

Terminology in this document follows [Terminology](./terminology.md).

## Product Positioning

`config.md` is an editor workflow, not a single-language parser.

- Markdown is the control plane for configuration authoring
- Source files stay as the source of truth
- The extension provides visual editing, navigation, and safe write-back

The long-term goal is to make this workflow independent of language format (Lua, JSON, and future adapters).

## Vision

Move from:

- "Markdown + Lua visual editing"

to:

- "Markdown + pluggable config adapters"

where each adapter provides:

- path resolution
- value lookup
- range-aware write-back
- jump target mapping for navigation (`probe://`)
- optional advanced capabilities (table editing, function/code editing, schema validation)

## Current State

- Lua: mature support (`number`, `slider`, `string`, `boolean`, `select`, `table`, `code`)
- JSON/JSONC:
  - phase 1 complete: value binding, probe navigation, value write-back
  - phase 2 complete: table editing for arrays of objects
  - `code` type is not supported

## Language-agnostic Principles

- One block syntax model in Markdown (`file`, `key`, `type`, options)
- Adapter-specific behavior should be explicit and documented
- Write-back should be localized and minimally destructive
- Navigation should be predictable across source formats
- Feature parity should evolve by phase, not by breaking existing workflows

## Planned Evolution

### Adapter architecture

- Introduce a formal adapter interface in core modules
- Decouple linker/patcher/parser naming from Lua-only terms
- Keep backward compatibility with current block syntax

### Feature roadmap

- Add schema-aware validation hooks
- Add richer diagnostics for unsupported combinations
- Expand wizard capabilities for non-Lua targets
- Evaluate additional adapters (YAML/TOML) after JSON hardening

## Non-goals

- Replacing native source editing
- Enforcing one canonical source format
- Auto-generating full source files from Markdown

## Success Metrics

- Reduced manual config editing time
- Stable write-back with low regression rate
- Consistent navigation experience across adapters
- Incremental feature parity across supported formats
