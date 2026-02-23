# Terminology

This document defines the canonical terms used across `config.md` documentation.

## Core naming model

- **Product name**: `config.md`
  - Means the VS Code extension and overall workflow.
- **Block syntax identifiers**: `lua-config`, `lua-wizard`
  - Means fenced-code language identifiers in Markdown.
  - These names are kept for backward compatibility.
- **Capability model**: Config Block / Wizard Block / Source Adapter
  - Means language-neutral concepts in architecture and product discussions.

## Term definitions

| Term | Definition | Use this when |
|---|---|---|
| `config.md` | Product/extension name | Talking about product, UX, roadmap, release |
| Config Block | A visual binding block in Markdown | Talking about generic block behavior |
| Wizard Block | A step-based action block in Markdown | Talking about generic wizard behavior |
| `lua-config` | Markdown fenced block identifier | Showing syntax examples or parser behavior |
| `lua-wizard` | Markdown fenced block identifier | Showing syntax examples or parser behavior |
| Source file | Target file edited by the extension | Referring to Lua/JSON/JSONC collectively |
| Source adapter | Format-specific parser/patcher/linker capability | Talking about language expansion architecture |

## Writing rules

- Use `config.md` for product-level text.
- Use "source file(s)" unless behavior is Lua-only.
- Use `lua-config` / `lua-wizard` only for syntax and compatibility context.
- If behavior is format-specific, state it explicitly:
  - "Lua-only", "JSON/JSONC supported", or "planned via adapters".

## Compatibility note

`lua-config` and `lua-wizard` are stable syntax names today.
Language-agnostic expansion is implemented through adapters, not by breaking existing Markdown syntax.
