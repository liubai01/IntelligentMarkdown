# Documentation Home

This is the top-level entry for `IntelligentMarkdown` documentation.  
If you are new to the project, read in this order: usage docs -> architecture docs -> release docs.

## What This Extension Does

`IntelligentMarkdown` is a VS Code extension that lets teams define configuration in Markdown, edit config values visually, and write changes back to source files with parser-assisted precision.

Core idea:

- Markdown is the configuration entrypoint (`lua-config`, `lua-wizard`)
- Webview is the interactive surface (controls, wizard, Mermaid)
- Source files remain editable and stable (targeted value patching)

## Product Direction

The long-term direction is **language-agnostic config workflows**:

- one Markdown interaction model
- multiple source adapters (Lua, JSON, and future formats)
- predictable navigation and write-back behavior across adapters

See [Product Strategy](./product-strategy.md) for full details.

## Terminology Baseline

Use this naming model across docs:

- Product: `config.md`
- Syntax identifiers: `lua-config`, `lua-wizard`
- Language-neutral concepts: Config Block, Wizard Block, Source Adapter

See [Terminology](./terminology.md).

## Current Core Capabilities

- Visual editing with `lua-config` (`number`, `slider`, `string`, `boolean`, `select`, `table`, `code`)
- Multi-step `lua-wizard` workflows (`append` and `run`)
- Mermaid rendering with clickable navigation
- `probe://` links for function/variable/marker jump targets
- Preview panel reuse, auto-open preview, and inline value decorations
- JSON support (phase 1 + phase 2): value binding, probe navigation, value write-back, and table editing

## Language Support Status

- Lua: mature support across binding, table editing, code editing, and wizard workflows
- JSON/JSONC:
  - phase 1 complete: value binding, hover/link navigation, probe path resolution, value updates
  - phase 2 complete: table editing for arrays of objects
  - phase 3 planned: wizard append patterns and deeper validation UX

## Framework Snapshot

```text
Markdown -> Parser(config/wizard) -> Linker(AST/probe) -> Webview UI
                 ^                      |
                 |                      v
            LuaParser/LuaPatcher <- user interaction messages
```

For details, see [Architecture](./architecture.md).

## Document Navigation

### Product

- [Product Strategy](./product-strategy.md)
- [Terminology](./terminology.md)

### Usage

- [User Guide](./user-guide.md)
- [lua-config Reference](./lua-config-reference.md)
- [Config Wizard Guide](./wizard.md)

### Engineering

- [Architecture](./architecture.md)

### Release

- [Quick Release](./quick-release.md)
- [Release Process](./release.md)
- [GitHub Actions Setup](./setup-github-actions.md)

## Recommended Reading Paths

- New users: `user-guide.md` -> `lua-config-reference.md` -> `wizard.md`
- Developers: `architecture.md` -> `lua-config-reference.md` -> `wizard.md`
- Maintainers: `quick-release.md` -> `release.md` -> `setup-github-actions.md`
