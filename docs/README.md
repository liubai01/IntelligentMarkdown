# Documentation Index

This index helps you navigate the up-to-date docs for `IntelligentMarkdown`.

## Start Here

- [Documentation Home](./overview.md): product context, scope, and architecture at a glance.
- [Product Strategy](./product-strategy.md): language-agnostic product direction and roadmap.
- [User Guide](./user-guide.md): practical onboarding and daily workflow.
- [Architecture](./architecture.md): module design and runtime data flow.

## Product Docs

- [Documentation Home](./overview.md): high-level understanding of the product.
- [Product Strategy](./product-strategy.md): long-term positioning and evolution plan.
- [Terminology](./terminology.md): naming conventions and canonical terms.

## Feature Docs

- [lua-config Reference](./lua-config-reference.md): complete syntax for `lua-config`, Mermaid, and `probe://`.
- [Config Wizard Guide](./wizard.md): `lua-wizard` workflows for `append` and `run`.
- [User Guide](./user-guide.md): first project setup and common usage patterns.

### Current Implementation Notes

- JSON phase 1 is available: value binding, probe navigation, and basic value write-back.
- JSON phase 2 is available: table editing for arrays of objects.
- `code` type remains Lua-focused.

## Engineering Docs

- [Architecture](./architecture.md): extension entrypoints, core modules, messaging, and caching behavior.

## Release and Operations

- [Quick Release](./quick-release.md): shortest path to publish a version.
- [Release Process](./release.md): full release workflow, troubleshooting, and safety notes.
- [GitHub Actions Setup](./setup-github-actions.md): one-time automation setup.

## Maintenance Notes

- When features change, update `overview.md` first, then the related focused doc.
- When product direction changes, update `product-strategy.md` and `overview.md` together.
- When syntax changes, update `lua-config-reference.md` or `wizard.md`, then align examples in `user-guide.md`.
- When release flow changes, keep `quick-release.md` and `release.md` consistent.
