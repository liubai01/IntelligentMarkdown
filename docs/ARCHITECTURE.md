# Intelligent Markdown for Lua - Architecture Document

## Project Overview

This project is a VS Code extension that provides a Markdown-based visual configuration editor for game designers. By defining special syntax in Markdown documents, designers can directly modify Lua configuration file variables in a **WYSIWYG** experience.

### Core Value

- **Lower Barrier**: Designers don't need to understand Lua syntax, just operate in familiar Markdown documents
- **Maintain Flexibility**: Programmers can still directly edit Lua code, keeping code structure intact
- **Two-way Sync**: Real-time bidirectional sync between Markdown and Lua files

### Current Implementation Status

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1: MVP Prototype | ✅ Complete | Lua parsing, document links, hover tips |
| Phase 2: Webview Editor | ✅ Complete | Visual preview, config controls |
| Phase 3: Two-way Binding | ✅ Complete | Control changes auto-write to Lua |
| Phase 4: Advanced Features | 🔄 In Progress | Auto-complete, type validation, etc. |

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Presentation Layer                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Smart Markdown Editor (Webview)               │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐  │  │
│  │  │ Input   │  │ Slider  │  │ Select  │  │ Boolean     │  │  │
│  │  │ Number  │  │ Range   │  │ Dropdown│  │ Toggle      │  │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ postMessage
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Logic Layer (Extension Host)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Linker    │  │   Watcher   │  │  SmartMarkdownEditor    │  │
│  │  Resolver   │  │   Monitor   │  │     Provider            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Data Layer (AST)                           │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐   │
│  │     Lua Parser      │  │       Lua Patcher               │   │
│  │   (luaparse AST)    │  │    (Precise value replacement)  │   │
│  └─────────────────────┘  └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Project Structure

```
intelligent-markdown/
├── package.json                 # Extension manifest
├── tsconfig.json               # TypeScript config
├── webpack.config.js           # Webpack bundler config
├── vitest.config.ts            # Test config
│
├── src/
│   ├── extension.ts            # Extension entry point
│   │
│   ├── core/                   # Core modules
│   │   ├── index.ts
│   │   ├── parser/
│   │   │   ├── luaParser.ts         # Lua AST parser
│   │   │   └── configBlockParser.ts # Config block parser
│   │   │
│   │   ├── linker/
│   │   │   ├── luaLinker.ts         # Lua file linker
│   │   │   └── pathResolver.ts      # Path resolver
│   │   │
│   │   └── patcher/
│   │       └── luaPatcher.ts        # Lua file patcher
│   │
│   ├── editor/                 # Editor module
│   │   ├── index.ts
│   │   └── smartMarkdownEditor.ts   # Webview preview editor
│   │
│   ├── providers/              # VS Code providers
│   │   ├── index.ts
│   │   ├── documentLinkProvider.ts  # Document links
│   │   ├── hoverProvider.ts         # Hover tooltips
│   │   └── decorationProvider.ts    # Inline decorations
│   │
│   ├── commands/               # Commands
│   │   ├── index.ts
│   │   └── showVariableValue.ts     # Show variable value command
│   │
│   └── types/                  # Type definitions
│       ├── index.ts
│       ├── configBlock.ts           # Config block types
│       ├── luaNode.ts               # Lua AST node types
│       └── luaparse.d.ts            # luaparse type declarations
│
├── test/                       # Test files
│   ├── unit/
│   │   ├── luaParser.test.ts
│   │   ├── luaPatcher.test.ts
│   │   └── configBlockParser.test.ts
│   │
│   └── fixtures/               # Test fixtures
│       ├── player_config.lua
│       └── player.config.md
│
├── docs/                       # Documentation
│   └── ARCHITECTURE.md         # Architecture doc (this file)
│
└── .vscode/                    # VS Code config
    ├── launch.json             # Debug config
    ├── tasks.json              # Task config
    └── settings.json           # Editor settings
```

---

## 3. Core Module Design

### 3.1 Smart Markdown Syntax (Protocol)

Using Markdown's Fenced Code Block syntax with `lua-config` language identifier:

````markdown
# Player Base Stats Config

Configure player spawn attributes here.

### Base Health
> Designer Note: Initial health should not exceed 10000, or it will affect game balance.

```lua-config
file: ./scripts/player_config.lua
key: PlayerConfig.BaseStats.HP
type: number
default: 100
min: 1
max: 10000
step: 10
label: Max Health
```

### Movement Speed

```lua-config
file: ./scripts/player_config.lua
key: PlayerConfig.BaseStats.MoveSpeed
type: slider
default: 200
range: [100, 500]
step: 10
label: Base Move Speed
unit: units/sec
```

### Character Class

```lua-config
file: ./scripts/player_config.lua
key: PlayerConfig.Class
type: select
options:
  - { value: "warrior", label: "Warrior" }
  - { value: "mage", label: "Mage" }
  - { value: "archer", label: "Archer" }
label: Default Class
```

### Tutorial Enabled

```lua-config
file: ./scripts/game_settings.lua
key: GameSettings.Tutorial.Enabled
type: boolean
label: Tutorial Switch
```
````

#### Config Block Property Reference

| Property | Required | Description |
|----------|----------|-------------|
| `file` | ✅ | Relative path to Lua file (relative to Markdown file) |
| `key` | ✅ | Lua variable path, dot-separated for nested levels |
| `type` | ✅ | Control type: `number`, `slider`, `string`, `boolean`, `select` |
| `label` | ❌ | Display label, defaults to last segment of key |
| `default` | ❌ | Default value |
| `min/max` | ❌ | Value range limits |
| `range` | ❌ | Slider-specific, equivalent to [min, max] |
| `step` | ❌ | Value step increment |
| `options` | ❌ | Select-specific, option list |
| `unit` | ❌ | Unit display |
| `readonly` | ❌ | Whether read-only |

---

### 3.2 Lua AST Parser

#### Core Implementation

```typescript
// src/core/parser/luaParser.ts

import * as luaparse from 'luaparse';

export class LuaParser {
  private ast: any;
  private code: string;

  constructor(code: string) {
    this.code = code;
    this.ast = luaparse.parse(code, {
      ranges: true,      // Enable range recording
      locations: true,   // Enable location recording
      comments: true,    // Preserve comment info
    });
  }

  /**
   * Find Lua variable node by path
   * @param keyPath Variable path, e.g., "PlayerConfig.BaseStats.HP"
   */
  findValueByPath(keyPath: string): LuaValueResult | null {
    const keys = keyPath.split('.');
    // Recursively traverse AST to locate target node
    // Return value, type, and range info
  }
}
```

#### Supported Path Formats

- `Config.BaseStats.HP` - Regular nesting
- `Config.Items[1].Name` - Array index (planned)
- `Config["special-key"].Value` - String key (planned)

---

### 3.3 Lua Patcher

#### Precise Write-back Strategy

```typescript
// src/core/patcher/luaPatcher.ts

export class LuaPatcher {
  /**
   * Update value in Lua file
   * Core principle: Only replace the value portion, preserve all comments and formatting
   */
  updateValue(
    code: string,
    range: [number, number],
    newValue: any,
    valueType: string
  ): string {
    const formattedValue = this.formatLuaValue(newValue, valueType);
    
    // Precise replacement: preserve all content before and after
    return code.slice(0, range[0]) + formattedValue + code.slice(range[1]);
  }

  /**
   * Convert JavaScript value to Lua format
   */
  private formatLuaValue(value: any, type: string): string {
    switch (type) {
      case 'number':
        return String(value);
      case 'string':
        return `"${this.escapeLuaString(value)}"`;
      case 'boolean':
        return value ? 'true' : 'false';
      default:
        return String(value);
    }
  }
}
```

---

### 3.4 Webview Preview Editor

#### Feature Status

| Feature | Status | Description |
|---------|--------|-------------|
| Markdown Rendering | ✅ | Headings, paragraphs, lists, quotes, code blocks |
| Config Block Controls | ✅ | number, slider, boolean, select, string |
| Value Sync | ✅ | Control changes auto-write to Lua file |
| Jump to Source | ✅ | Click locate button to jump to Lua code |
| Refresh Button | ✅ | Re-read Lua file to update display |
| Change Highlight | ✅ | Highlight feedback after control changes |

#### Control Types

| Type | Render | Description |
|------|--------|-------------|
| `number` | Number input + ± buttons | Supports min/max/step |
| `slider` | Slider + value display | Supports range/step |
| `boolean` | Toggle switch | Click to toggle true/false |
| `select` | Dropdown | Supports options list |
| `string` | Text input | General string input |
| `table` | Editable data table | Batch edit Lua arrays with spreadsheet interface |

---

## 4. Data Flow & Interaction

### 4.1 Initialization Flow

```
┌──────────────┐     ┌───────────────┐     ┌─────────────┐     ┌──────────────┐
│  User opens  │     │  Extension    │     │  Lua Files  │     │   Webview    │
│  config.md   │────▶│  Parse MD     │────▶│  Read & AST │────▶│  Render UI   │
└──────────────┘     └───────────────┘     └─────────────┘     └──────────────┘
                            │                      │
                            │   Extract configs    │   Get current values
                            ▼                      ▼
                     ┌─────────────────────────────────────┐
                     │  linkedBlocks: [                    │
                     │    { file, key, type, value: 100 }  │
                     │    { file, key, type, value: 200 }  │
                     │  ]                                   │
                     └─────────────────────────────────────┘
```

### 4.2 Value Modification Flow

```
┌──────────────┐                          ┌───────────────┐
│  User changes│    postMessage           │   Extension   │
│  HP: 100→200 │  ────────────────────▶   │   Host        │
└──────────────┘                          └───────┬───────┘
                                                  │
        ┌─────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────┐
│  1. Read player_config.lua                                │
│  2. AST parse, locate PlayerConfig.BaseStats.HP           │
│  3. Get range: [156, 159]                                │
│  4. Replace: code.slice(0,156) + "200" + code.slice(159) │
│  5. Write file                                            │
└───────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────┐
│ Lua file     │
│ updated      │
└──────────────┘
```

### 4.3 Reverse Sync Flow (Lua → Webview)

```
┌───────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Programmer   │     │  FileWatcher     │     │  Webview    │
│  edits Lua    │────▶│  Detect change   │────▶│  Update UI  │
└───────────────┘     └──────────────────┘     └─────────────┘
                              │
                              │ Re-parse AST
                              │ Extract new values
                              │ postMessage
                              ▼
                       ┌─────────────┐
                       │ HP: 200→300 │
                       │ (auto-refresh)│
                       └─────────────┘
```

---

## 5. Extension Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `intelligentMarkdown.autoSave` | boolean | `true` | Auto-save Lua file changes |
| `intelligentMarkdown.showInlineValues` | boolean | `true` | Show inline values in editor |
| `intelligentMarkdown.autoOpenPreview` | boolean | `false` | Auto-open preview for Markdown |
| `intelligentMarkdown.autoOpenPreviewPattern` | string | `**/*.config.md` | Glob pattern for auto-preview |
| `intelligentMarkdown.autoOpenPreviewOnlyWithLuaConfig` | boolean | `true` | Only auto-preview if file contains lua-config blocks |

### Auto-preview Configuration Example

```json
{
  // Enable auto-preview
  "intelligentMarkdown.autoOpenPreview": true,
  
  // Match all Markdown files
  "intelligentMarkdown.autoOpenPreviewPattern": "**/*.md",
  
  // Only auto-open if contains lua-config blocks
  "intelligentMarkdown.autoOpenPreviewOnlyWithLuaConfig": true
}
```

---

## 6. Development Roadmap

### Phase 1: MVP Prototype ✅

| Task | Status | Description |
|------|--------|-------------|
| Project Setup | ✅ | VS Code extension project structure |
| Lua Parser | ✅ | AST parsing and path location |
| Config Block Parser | ✅ | lua-config code block parsing |
| Document Links | ✅ | Click to jump to Lua source |
| Hover Tooltips | ✅ | Display current variable value |
| Inline Values | ✅ | Show values in editor |

### Phase 2: Webview Editor ✅

| Task | Status | Description |
|------|--------|-------------|
| Webview Basics | ✅ | Preview panel framework |
| Markdown Rendering | ✅ | Document content rendering |
| Config Controls | ✅ | 5 control types |
| Data Display | ✅ | Show Lua current values |

### Phase 3: Two-way Binding ✅

| Task | Status | Description |
|------|--------|-------------|
| Value Write-back | ✅ | Write to Lua after UI changes |
| File Watching | ✅ | Update UI when Lua changes |
| Auto-preview | ✅ | Configurable auto-open preview |

### Phase 4: Advanced Features 🔄

| Feature | Priority | Status |
|---------|----------|--------|
| Table Editor | High | ✅ |
| Type Validation | High | ⬜ |
| Auto-complete | Medium | ⬜ |
| Array Editing | Medium | ⬜ |
| Color Picker | Low | ⬜ |
| Batch Operations | Low | ⬜ |

---

## 7. Tech Stack Summary

| Layer | Technology | Description |
|-------|------------|-------------|
| **Extension** | TypeScript | VS Code extension development |
| **AST Parsing** | luaparse | Lua syntax parsing |
| **Build Tool** | Webpack 5 | Bundle extension |
| **Testing** | Vitest | Unit test framework |
| **Webview** | Native HTML/CSS/JS | Preview interface |

---

## 8. Key Challenges & Solutions

### Challenge 1: Complex Lua Table Nesting

**Problem**: Lua Tables can be arbitrarily nested, how to accurately locate?

**Solution**: Recursively traverse AST, support dot-separated path expressions.

### Challenge 2: Preserve Lua File Format and Comments

**Problem**: Directly regenerating Lua code would lose comments and formatting.

**Solution**: Only replace the value portion, use range for precise location.

```typescript
// Only replace value, preserve all surrounding content
const newCode = code.slice(0, range[0]) + newValue + code.slice(range[1]);
```

### Challenge 3: HTML Escaped in Markdown

**Problem**: Config block control HTML gets escaped by Markdown converter.

**Solution**: Placeholder strategy:
1. Replace config blocks with placeholders first
2. Perform Markdown conversion
3. Finally replace placeholders with HTML controls

---

## 9. Future Extension Directions

1. **Multi-language Support**: Extend to JSON, YAML, TOML config formats
2. **Team Collaboration**: Integrate Git change tracking
3. **Version Comparison**: Visual diff between config versions
4. **Template System**: Preset common config templates
5. **Permission Control**: Set certain critical configs as read-only
6. **Export Feature**: Export Markdown to PDF/HTML documents

---

## 10. References

- [VS Code Extension API](https://code.visualstudio.com/api)
- [VS Code Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [luaparse - Lua Parser for JavaScript](https://github.com/fstirlitz/luaparse)
- [VS Code Custom Editor API](https://code.visualstudio.com/api/extension-guides/custom-editors)

---

*Document Version: v2.0*
*Last Updated: 2026-02*
