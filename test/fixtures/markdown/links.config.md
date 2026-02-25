# Link Navigation Test Suite

Validates that various Markdown link types render correctly in the preview
and can be intercepted for navigation.

---

## 1) Relative Markdown Links

- [Link Target](./link_target.md)
- [Player Config](../lua-config/player.config.md)

## 2) External Links

- [VS Code](https://code.visualstudio.com/)
- [GitHub](https://github.com/liubai01/IntelligentMarkdown)

## 3) Anchor Links

- [Jump to Section 5](#5-mixed-content)
- [Jump to External Links](#2-external-links)

## 4) Links with Special Characters

- [Path with spaces](./link_target.md)
- [中文链接文字](./link_target.md)

## 5) Mixed Content

A paragraph with an [inline relative link](./link_target.md) and an
[inline external link](https://example.com) in the same block.

Also a bare URL that should be auto-linked: https://example.com/auto

## 6) Config Block After Links

```lua-config
file: ../lua-config/player_config.lua
key: PlayerConfig.BaseStats.HP
type: slider
range: [100, 5000]
step: 100
label: Player HP
```
