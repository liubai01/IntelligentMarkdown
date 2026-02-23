# Documentation Home

This is the top-level entry for `IntelligentMarkdown` documentation.  
If you are new to the project, read in this order: usage docs -> architecture docs -> release docs.

## What This Extension Does

`IntelligentMarkdown` is a VS Code extension that lets teams define configuration in Markdown, edit config values visually, and write changes back to source files with parser-assisted precision.

Core idea:

- Markdown is the configuration entrypoint (`lua-config`, `lua-wizard`)
- Webview is the interactive surface (controls, wizard, Mermaid)
- Source files remain editable and stable (targeted value patching)

## Current Core Capabilities

- Visual editing with `lua-config` (`number`, `slider`, `string`, `boolean`, `select`, `table`, `code`)
- Multi-step `lua-wizard` workflows (`append` and `run`)
- Mermaid rendering with clickable navigation
- `probe://` links for function/variable/marker jump targets
- Preview panel reuse, auto-open preview, and inline value decorations
- JSON support (phase 1): value binding + probe navigation + basic value write-back

## JSON Roadmap Status

- Phase 1 (completed): JSON path binding, hover/link navigation, `probe://` JSON path resolution, basic value updates
- Phase 2 (in progress): JSON table editing (`type: table`) with row/column cell write-back
- Phase 3 (planned): JSON-focused wizard append workflows and expanded validation/UX

## Framework Snapshot

```text
Markdown -> Parser(config/wizard) -> Linker(AST/probe) -> Webview UI
                 ^                      |
                 |                      v
            LuaParser/LuaPatcher <- user interaction messages
```

For details, see [Architecture](./architecture.md).

## Document Navigation

### Usage

- [User Guide](./user-guide.md)
- [lua-config Reference](./lua-config-reference.md)
- [Lua Wizard Guide](./wizard.md)

### Engineering

- [Architecture](./architecture.md)

### Release

- [Quick Release](./quick-release.md)
- [Release Process](./release.md)
- [GitHub Actions Setup](./setup-github-actions.md)

## Recommended Reading Paths

- New users: `USER_GUIDE` -> `lua-config-reference` -> `WIZARD`
- Developers: `ARCHITECTURE` -> `lua-config-reference` -> `WIZARD`
- Maintainers: `QUICK_RELEASE` -> `RELEASE` -> `SETUP_GITHUB_ACTIONS`
