# Architecture

`IntelligentMarkdown` is a VS Code extension that turns Markdown into an interactive configuration surface.  
Users define structured blocks in Markdown, and the extension handles parsing, rendering, write-back, and source navigation.

## Architecture Overview

```text
Markdown document
  |- lua-config blocks
  |- lua-wizard blocks
  |- Mermaid blocks
  '- probe:// links
        |
        v
Extension Host
  |- Parsing: ConfigBlockParser / WizardBlockParser
  |- Linking: LuaLinker / ProbeScanner / PathResolver
  |- Write-back: LuaPatcher/LuaParser + JsonPatcher/JsonParser
  |- Editor: SmartMarkdownEditorProvider(Webview)
  '- Providers/Commands: links, hover, decorations, commands
        | postMessage
        v
Webview UI
  |- Standard controls (number/slider/string/boolean/select)
  |- Heavy controls (table/code, deferred init)
  |- Wizard execution (append/run)
  '- Mermaid rendering + probe navigation
```

## Core Modules

### Extension entry and lifecycle

- Entry file: `src/extension.ts`
- Registers:
  - Document link providers (Markdown + Lua)
  - Hover provider
  - Decoration provider
  - Commands (open preview, refresh bindings, navigation)
- Reuses a single preview panel instance to avoid panel spam.

### Core capability layer

- `src/core/parser/configBlockParser.ts`
  - Parses `lua-config` blocks (YAML)
  - Validates required fields and type-specific constraints
- `src/core/parser/wizardBlockParser.ts`
  - Parses `lua-wizard` blocks
  - Supports both `append` and `run` actions
- `src/core/linker/luaLinker.ts`
  - Resolves Markdown blocks to Lua AST nodes and current values
- `src/core/parser/luaParser.ts`
  - Provides AST path lookup and function/node resolution via `luaparse`
- `src/core/parser/jsonParser.ts`
  - Provides JSON path lookup and location metadata (`line/column/range`)
- `src/core/patcher/luaPatcher.ts`
  - Applies targeted range-based replacement to preserve source formatting
- `src/core/patcher/jsonPatcher.ts`
  - Applies path-based JSON edits via `jsonc-parser`
- `src/core/probeScanner.ts`
  - Parses and caches probe markers for `probe://` links and Mermaid click navigation

### Editor and rendering layer

- `src/editor/smartMarkdownEditor.ts`
  - Parses and renders Markdown preview content
  - Handles Webview messages (value updates, table cell updates, wizard actions, refresh)
  - Defers heavy block initialization (`table`, `code`) for better first paint
  - Resolves `probe://` links into clickable navigation UI with copyable context

### Providers and command layer

- `src/providers/documentLinkProvider.ts`: Markdown link resolution and navigation entry
- `src/providers/luaDocLinkProvider.ts`: Lua doc-link navigation back to Markdown
- `src/providers/hoverProvider.ts`: hover value lookup
- `src/providers/decorationProvider.ts`: inline value decorations
- `src/commands/showVariableValue.ts`: command-based value inspection

## Supported Block Types and Behaviors

### lua-config

- Implemented types: `number`, `slider`, `string`, `boolean`, `select`, `table`, `code`
- Reserved (declared, not implemented): `color`, `array`
- Key behavior:
  - `table` and `code` blocks are lazily initialized
  - Value updates write back to Lua and clear relevant caches
  - JSON files (`.json`, `.jsonc`) are supported for phase-1 value binding/editing
  - JSON `table` and `code` types are reserved for later phases

### lua-wizard

- `append`: render template and append generated entries to target Lua tables
- `run`: render command template and execute commands sequentially
- Execution includes confirmation and structured result reporting back to Webview

### Mermaid and probe

- Native Mermaid rendering in preview
- Supports `click Node "probe://...#target"` directives
- Probe resolution priority:
  - `@probe` comment markers
  - function path resolution
  - variable/table path resolution
  - JSON path resolution (`A.B[1].C`) when target file is JSON/JSONC

## Key Data Flows

### Initial render flow

1. Open Markdown in preview
2. Parse `lua-config` and `lua-wizard` blocks
3. Link blocks to Lua AST and read current values
4. Send base HTML first, then hydrate heavy blocks asynchronously

### Value update write-back flow

1. Webview sends an update message
2. Extension host resolves target node/range in Lua AST
3. Apply targeted replacement and write file
4. Clear cache and send result back to Webview

### Navigation and reverse linkage

- Preview interactions can jump to Lua source positions
- Lua doc links can open Markdown preview and scroll to sections
- File watchers trigger refresh where needed

## Current Extension Settings

The current extension contributes these settings:

- `intelligentMarkdown.autoSave`
- `intelligentMarkdown.showInlineValues`
- `intelligentMarkdown.autoOpenPreview`
- `intelligentMarkdown.autoOpenPreviewPattern`

Outdated settings not present in current contributed configuration are intentionally excluded from this document.

## Maintenance Guidelines

- When adding new block types, update `src/types`, parser validation, Webview rendering, and `lua-config-reference.md` together.
- When changing message contracts, keep sender/receiver branches in `smartMarkdownEditor.ts` aligned.
- When touching path resolution and navigation logic, verify both Windows and POSIX path behavior.
