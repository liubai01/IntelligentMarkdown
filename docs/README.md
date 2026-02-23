# Documentation Index

This index helps you navigate the up-to-date docs for `IntelligentMarkdown`.

## Start Here

- [Documentation Home](./overview.md): product context, scope, and architecture at a glance.
- [User Guide](./user-guide.md): practical onboarding and daily workflow.
- [Architecture](./architecture.md): module design and runtime data flow.

## Usage Docs

- [lua-config Reference](./lua-config-reference.md): complete syntax for `lua-config`, Mermaid, and `probe://`.
- [Lua Wizard Guide](./wizard.md): `lua-wizard` workflows for `append` and `run`.
- [User Guide](./user-guide.md): first project setup and common usage patterns.

## Development Docs

- [Architecture](./architecture.md): extension entrypoints, core modules, messaging, and caching behavior.

## Release and Operations

- [Quick Release](./quick-release.md): shortest path to publish a version.
- [Release Process](./release.md): full release workflow, troubleshooting, and safety notes.
- [GitHub Actions Setup](./setup-github-actions.md): one-time automation setup.

## Outdated Content Removed

- Removed references to `intelligentMarkdown.autoOpenPreviewOnlyWithLuaConfig`, which is not exposed in the current extension configuration.
- Replaced stale phase/status roadmap sections with current capabilities and extension points.

## Maintenance Notes

- When features change, update `overview.md` first, then the related focused doc.
- When syntax changes, update `lua-config-reference.md` or `wizard.md`, then align examples in `user-guide.md`.
- When release flow changes, keep `quick-release.md` and `release.md` consistent.
