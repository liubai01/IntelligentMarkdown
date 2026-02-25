# Ecosystem Positioning Research

This document provides an objective positioning analysis for `config.md` as an enhancement layer on top of the Cursor / CodeBuddy ecosystem.

It focuses on product shape, interaction model, differentiation, and practical trade-offs.

---

## 1) Scope and framing

`config.md` is **not** trying to replace AI IDEs (Cursor, CodeBuddy, Copilot-style chat, agentic tools).

Instead, it is positioned as a **spec interaction layer** that sits above those ecosystems:

- AI IDEs remain strong at code generation and multi-file edits.
- `config.md` adds structured, markdown-native, human-in-the-loop specification workflows.

In short:

- AI IDEs optimize **execution speed**.
- `config.md` optimizes **spec quality, traceability, and cross-role collaboration**.

---

## 2) Comparison baseline

Mainstream AI coding products generally center around:

1. Chat threads and prompt interactions
2. Inline code edits and patch application
3. Agentic file/terminal automation

Representative products:

- GitHub Copilot Chat
- Cursor
- CodeBuddy
- Continue
- Cline / Windsurf-style agentic IDE workflows

These products are strong in implementation velocity, but usually treat spec artifacts as secondary outputs.

---

## 3) Where `config.md` is different

### 3.1 Markdown-first control plane

`config.md` treats markdown as the persistent interaction surface:

- `lua-config` blocks for structured parameters
- `lua-wizard` blocks for guided prompt workflows
- Mermaid + `probe://` links for architecture-to-code navigation

This yields a durable artifact, not only a transient chat response.

### 3.2 Human-friendly + AI-friendly duality

The same file supports both:

- **Human input ergonomics** (forms, tables, toggles, step-by-step wizard)
- **AI execution context** (`@file` targeting, structured fields, reusable variables)

This duality is uncommon in current AI coding plugins, which often optimize one side.

### 3.3 Write-back loops

`config.md` now supports two persistence modes:

- `storage: source` (write back to Lua/JSON files)
- `storage: markdown` (write back to the markdown block itself)

This enables iterative design/spec work before final source coupling.

### 3.4 Cross-block variable references

Wizard prompts can resolve config values from the same markdown document:

- `type: config`
- `markdown-key` for conflict-safe references

This allows prompt generation from live spec state, not only external JSON files.

---

## 4) Capability matrix (high-level)

| Dimension | Mainstream AI IDEs | `config.md` |
|---|---|---|
| Primary interaction | Chat / agent loop | Markdown spec + visual controls + wizard |
| Multi-file autonomous edits | Strong | Delegated to host IDE AI |
| Structured spec authoring | Limited / ad hoc | First-class |
| Spec artifact persistence | Weak to medium | Strong (markdown-native) |
| Cross-role collaboration (design + dev) | Medium | Strong |
| Architecture navigation from docs | Usually weak | Mermaid + `probe://` links |
| Config write-back safety | Varies | Parser/patcher-backed adapters |

Interpretation:

- `config.md` is not stronger at autonomous coding than agent-first IDE tools.
- It is stronger at turning intent into a maintainable, evolvable spec asset.

---

## 5) Product advantages (current)

1. **SpecCoding workflow**: AI-generated starter spec + human interactive refinement + iterative expansion.
2. **Low-friction artifact model**: markdown remains readable, diffable, reviewable in Git.
3. **Adapter strategy**: Lua mature, JSON/JSONC progressing, same interaction model.
4. **Prompt context control**: wizard prompt injection with explicit `@file` targeting.
5. **Design-to-code bridge**: designer-friendly fields can still drive code-oriented outputs.

---

## 6) Current limitations and risks

Objective gaps to acknowledge:

1. **Automation depth**: heavy autonomous execution remains better in agent-first products.
2. **Template dependence**: quality depends on good fixture/wizard templates.
3. **Market education**: users must understand “spec interaction” vs “chat-only coding”.
4. **Ecosystem leverage risk**: as host IDEs evolve, overlap with native features may increase.

---

## 7) Positioning statement (recommended)

Recommended external positioning:

> `config.md` is an AI-ecosystem enhancement layer that turns markdown into a collaborative, interactive spec system for both humans and AI.

More concise:

> Not another chat plugin — a markdown-native SpecCoding layer on top of Cursor/CodeBuddy.

---

## 8) Strategic implications

To strengthen defensibility, prioritize:

1. Reusable domain templates (game modding, liveops, release ops, config governance)
2. Stronger “output backfill” tooling (safe patch apply into target blocks)
3. Better diff/validation UX for AI-proposed markdown updates
4. Team-level governance hooks (rules, review checkpoints, policy-aware prompts)

---

## 9) Conclusion

`config.md` is best understood as a **complement** to AI IDE ecosystems, not a competitor to their core coding loops.

Its unique value is the structured spec layer:

- durable,
- collaborative,
- AI-consumable,
- and operationally maintainable.

That positioning is both realistic and differentiating in the current market.

