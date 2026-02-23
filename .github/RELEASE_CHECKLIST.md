# 🚀 Release Checklist

Quick reference for releasing a new version.

## ✅ Pre-Release

- [ ] All features/fixes are merged to `master`
- [ ] All tests pass: `npm test`
- [ ] Code is compiled: `npm run compile`
- [ ] Version number updated in `package.json`

## 📦 Release Commands

```bash
# Update version in package.json first!

# Run tests
npm test

# Commit version bump
git add package.json
git commit -m "chore: bump version to X.Y.Z"
git push origin master

# Create and push tag (triggers automation)
git tag vX.Y.Z
git push origin vX.Y.Z
```

## 🤖 Automated Steps (GitHub Actions)

After pushing the tag, GitHub Actions automatically:

1. ✅ Runs all tests
2. ✅ Compiles production build
3. ✅ Packages extension (.vsix)
4. ✅ Publishes to VS Code Marketplace
5. ✅ Creates GitHub Release with notes
6. ✅ Attaches .vsix file to release

## 🔍 Verification

- [ ] GitHub Actions workflow completed: https://github.com/liubai01/IntelligentMarkdown/actions
- [ ] GitHub Release created: https://github.com/liubai01/IntelligentMarkdown/releases
- [ ] Marketplace updated (5-10 min): https://marketplace.visualstudio.com/items?itemName=liubai01.config-md

## 🆘 If Something Goes Wrong

| Issue | Quick Fix |
|-------|-----------|
| Workflow fails | Check logs in GitHub Actions |
| PAT expired | Update `VSCE_PAT` secret in repo settings |
| Version exists | Bump version number and retry |
| Tests fail | Fix tests before tagging |

## 📚 Documentation

- Quick Guide: [docs/quick-release.md](../docs/quick-release.md)
- Full Process: [docs/release.md](../docs/release.md)
- Setup Guide: [docs/setup-github-actions.md](../docs/setup-github-actions.md)
