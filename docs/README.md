# Documentation Index

Welcome to the config.md extension documentation!

## For Developers

### Release & Publishing

- **[Quick Release Guide](./QUICK_RELEASE.md)** - TL;DR for releasing new versions
- **[Complete Release Process](./RELEASE.md)** - Detailed release workflow and standards
- **[GitHub Actions Setup](./SETUP_GITHUB_ACTIONS.md)** - One-time configuration for automated releases

### Quick Start: Release a New Version

```bash
# 1. Update version in package.json
# 2. Test, commit, and tag
npm test
git add package.json
git commit -m "chore: bump version to X.Y.Z"
git push origin master
git tag vX.Y.Z
git push origin vX.Y.Z

# ✅ GitHub Actions auto-publishes to Marketplace!
```

## Documentation Files

| File | Purpose | Audience |
|------|---------|----------|
| [QUICK_RELEASE.md](./QUICK_RELEASE.md) | Fast reference for releases | Developers, AI Assistants |
| [RELEASE.md](./RELEASE.md) | Complete release standards | Developers, Maintainers |
| [SETUP_GITHUB_ACTIONS.md](./SETUP_GITHUB_ACTIONS.md) | GitHub Actions configuration | Repository Admins |

## For AI Assistants

When helping with releases:

1. **Read** [QUICK_RELEASE.md](./QUICK_RELEASE.md) for the standard process
2. **Follow** the checklist in [RELEASE.md](./RELEASE.md)
3. **Never** commit or expose PAT tokens
4. **Always** create git tags to trigger automated publishing
5. **Verify** `.vscode-pat` is git-ignored and excluded from package

## Key Concepts

### Automated Release Flow

```
Developer                GitHub Actions              VS Code Marketplace
    |                           |                              |
    |--[1. Update version]----->|                              |
    |--[2. Push commit]-------->|                              |
    |--[3. Push tag v0.4.2]---->|                              |
    |                           |--[4. Run tests]              |
    |                           |--[5. Build extension]        |
    |                           |--[6. Publish]--------------->|
    |                           |--[7. Create GitHub Release]  |
    |                           |                              |
    |<-[8. Release complete]----+<-[9. Version live]-----------+
```

### Version Numbering

Follow [Semantic Versioning](https://semver.org/):

- **PATCH** (0.0.x): Bug fixes → `0.4.1` → `0.4.2`
- **MINOR** (0.x.0): New features → `0.4.2` → `0.5.0`
- **MAJOR** (x.0.0): Breaking changes → `0.5.0` → `1.0.0`

### Security

- ✅ PAT stored in GitHub Secrets (`VSCE_PAT`)
- ✅ `.vscode-pat` git-ignored (local development only)
- ✅ `.vscodeignore` excludes sensitive files from package
- ❌ Never commit tokens to repository

## Useful Links

- **Marketplace**: https://marketplace.visualstudio.com/items?itemName=liubai01.config-md
- **GitHub Releases**: https://github.com/liubai01/IntelligentMarkdown/releases
- **GitHub Actions**: https://github.com/liubai01/IntelligentMarkdown/actions
- **Publisher Dashboard**: https://marketplace.visualstudio.com/manage/publishers/liubai01

## Contributing

When contributing release-related changes:

1. Update relevant documentation in `docs/`
2. Test the workflow before merging
3. Keep security best practices in mind
4. Update this index if adding new docs

---

**Last Updated**: 2026-02-15  
**Maintained By**: liubai01
