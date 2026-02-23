# Quick Release Guide

## TL;DR - Release in 4 Commands

```bash
# 1. Update version in package.json (e.g., 0.4.1 → 0.4.2)
# 2. Test, commit, and tag
npm test
git add package.json
git commit -m "chore: bump version to 0.4.2"
git push origin master
git tag v0.4.2
git push origin v0.4.2

# ✅ Done! GitHub Actions auto-publishes to Marketplace
```

## What Happens Automatically

When you push a tag (e.g., `v0.4.2`):

1. ✅ GitHub Actions triggers
2. ✅ Runs all tests
3. ✅ Compiles production build
4. ✅ Packages extension (.vsix)
5. ✅ Publishes to VS Code Marketplace
6. ✅ Creates GitHub Release with notes
7. ✅ Attaches .vsix file to release

**Wait 5-10 minutes** → New version live on Marketplace!

## First Time Setup

Only needed once:

1. **Create PAT**: https://dev.azure.com/ → Personal Access Tokens
   - Scope: Marketplace (Manage)
   
2. **Add to GitHub**: https://github.com/liubai01/IntelligentMarkdown/settings/secrets/actions
   - Secret name: `VSCE_PAT`
   - Secret value: Your PAT token

## Monitoring

- **GitHub Actions**: https://github.com/liubai01/IntelligentMarkdown/actions
- **Releases**: https://github.com/liubai01/IntelligentMarkdown/releases
- **Marketplace**: https://marketplace.visualstudio.com/items?itemName=liubai01.config-md

## Common Issues

| Issue | Solution |
|-------|----------|
| PAT expired | Update secret in GitHub Settings → Secrets |
| Version exists | Bump version number in package.json |
| Tests fail | Fix tests before tagging |
| Tag/version mismatch | Ensure tag `v0.4.2` matches `"version": "0.4.2"` |

For detailed information, see [release.md](./release.md)
