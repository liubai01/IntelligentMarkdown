# Release Process Guide

## Overview

This document describes the standard release process for the config.md VS Code extension. The process is automated via GitHub Actions and triggered by creating a git tag.

## Prerequisites

### One-Time Setup

1. **Visual Studio Marketplace Personal Access Token (PAT)**
   - Visit: https://dev.azure.com/
   - User Settings → Personal Access Tokens
   - Create new token with:
     - Name: `VSCode Marketplace Publisher`
     - Organization: All accessible organizations
     - Scope: **Marketplace (Manage)** ✅
     - Expiration: Set appropriate duration

2. **Configure GitHub Secret**
   - Go to: https://github.com/liubai01/IntelligentMarkdown/settings/secrets/actions
   - Click "New repository secret"
   - Name: `VSCE_PAT`
   - Value: Paste your PAT token
   - Click "Add secret"

3. **Verify GitHub Actions Permissions**
   - Go to: https://github.com/liubai01/IntelligentMarkdown/settings/actions
   - Ensure "Read and write permissions" is enabled

4. **Open VSX Registry (for CodeBuddy / VSCodium)** — optional but recommended
   - Create an [Eclipse account](https://accounts.eclipse.org/user/register) (use same GitHub username)
   - Log in to [open-vsx.org](https://open-vsx.org/) with GitHub, sign the Publisher Agreement
   - Create an [access token](https://open-vsx.org/user-settings/tokens)
   - Create namespace: `npx ovsx create-namespace liubai01 -p YOUR_TOKEN`
   - Add GitHub secret: `OPEN_VSX_TOKEN` = your token
   - See [Publishing Extensions · eclipse/openvsx Wiki](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions)

## Release Process

### Step 1: Update Version Number

```bash
# Edit package.json and bump the version
# Example: 0.4.1 → 0.4.2
```

Update the `version` field in `package.json`:
```json
{
  "version": "0.4.2"
}
```

### Step 2: Run Tests

```bash
npm test
```

Ensure all tests pass before releasing.

### Step 3: Commit Version Bump

```bash
git add package.json
git commit -m "chore: bump version to 0.4.2"
git push origin master
```

### Step 4: Create and Push Git Tag

This is the **trigger** for automated release:

```bash
# Create tag with version number (must match package.json)
git tag v0.4.2

# Push tag to GitHub (this triggers the release workflow)
git push origin v0.4.2
```

### Step 5: Monitor Release

1. **Check GitHub Actions**
   - Visit: https://github.com/liubai01/IntelligentMarkdown/actions
   - Watch the "Publish Extension" workflow
   - Verify it completes successfully

2. **Check Marketplace** (5-10 minutes after publish)
   - Visit: https://marketplace.visualstudio.com/items?itemName=liubai01.config-md
   - Verify new version is live

3. **Check GitHub Release** (auto-created)
   - Visit: https://github.com/liubai01/IntelligentMarkdown/releases
   - Verify release notes are created

## Quick Reference

### Complete Release Commands

```bash
# 1. Update version in package.json manually
# 2. Run tests
npm test

# 3. Commit and tag
git add package.json
git commit -m "chore: bump version to X.Y.Z"
git push origin master

# 4. Create and push tag (triggers automation)
git tag vX.Y.Z
git push origin vX.Y.Z

# Done! GitHub Actions handles the rest.
```

### Manual Release (Fallback)

If GitHub Actions fails, you can publish manually:

```bash
# Compile production build
npm run compile

# Publish to marketplace
npx vsce publish -p YOUR_PAT_TOKEN
```

## Version Numbering

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (x.0.0): Breaking changes
- **MINOR** (0.x.0): New features (backward compatible)
- **PATCH** (0.0.x): Bug fixes

Examples:
- Bug fix: `0.4.1` → `0.4.2`
- New feature: `0.4.2` → `0.5.0`
- Breaking change: `0.5.0` → `1.0.0`

## Troubleshooting

### PAT Token Expired

1. Revoke old token: https://dev.azure.com/ → Personal Access Tokens
2. Create new token (same permissions)
3. Update GitHub Secret: https://github.com/liubai01/IntelligentMarkdown/settings/secrets/actions

### GitHub Action Failed

1. Check workflow logs: https://github.com/liubai01/IntelligentMarkdown/actions
2. Common issues:
   - PAT expired → Update GitHub Secret
   - Version already exists → Bump version number
   - Build failed → Check compilation errors
3. Fix issue and re-run workflow or publish manually

### Tag Pushed but No Release

1. Verify tag format: Must be `vX.Y.Z` (with 'v' prefix)
2. Check GitHub Actions is enabled
3. Verify `VSCE_PAT` secret exists and is valid

### Open VSX Publish Fails (CodeBuddy)

1. Create namespace first: `npx ovsx create-namespace liubai01 -p YOUR_TOKEN`
2. Verify `OPEN_VSX_TOKEN` secret is set in GitHub
3. Ensure Publisher Agreement is signed at [open-vsx.org](https://open-vsx.org/user-settings/profile)

## Security Notes

- ⚠️ **Never commit PAT tokens** to the repository
- ✅ PAT is stored securely in GitHub Secrets
- ✅ `.vscode-pat` is git-ignored (for local development only)
- ✅ `.vscodeignore` excludes `.vscode-pat` from extension package

## Useful Links

- **VS Code Marketplace**: https://marketplace.visualstudio.com/items?itemName=liubai01.config-md
- **Open VSX (CodeBuddy)**: https://open-vsx.org/extension/liubai01/config-md
- **Publisher Dashboard**: https://marketplace.visualstudio.com/manage/publishers/liubai01
- **GitHub Releases**: https://github.com/liubai01/IntelligentMarkdown/releases
- **GitHub Actions**: https://github.com/liubai01/IntelligentMarkdown/actions
- **Azure DevOps PAT**: https://dev.azure.com/

## Checklist for AI Assistants

When helping with releases, ensure:

- [ ] Version in `package.json` is updated
- [ ] All tests pass (`npm test`)
- [ ] Version commit is pushed to master
- [ ] Git tag matches package.json version (with 'v' prefix)
- [ ] Tag is pushed to trigger GitHub Actions
- [ ] `OPEN_VSX_TOKEN` secret set (optional, for CodeBuddy)
- [ ] Never expose or commit PAT tokens
- [ ] `.vscode-pat` remains git-ignored
- [ ] `.vscodeignore` excludes sensitive files
