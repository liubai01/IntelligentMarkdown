# GitHub Actions Setup Guide

## One-Time Configuration

Follow these steps to enable automated releases via GitHub Actions.

## Step 1: Create Visual Studio Marketplace PAT

1. **Visit Azure DevOps**
   - Go to: https://dev.azure.com/
   - Sign in with your Microsoft account

2. **Create Personal Access Token**
   - Click your profile icon (top right) → **Personal Access Tokens**
   - Click **+ New Token**
   
3. **Configure Token**
   - **Name**: `VSCode Marketplace Publisher - GitHub Actions`
   - **Organization**: Select **All accessible organizations**
   - **Expiration**: Choose duration (recommend 90 days or 1 year)
   - **Scopes**: 
     - Click **Show all scopes**
     - Scroll to **Marketplace**
     - Check ✅ **Manage** (this includes Acquire and Publish)
   
4. **Create and Copy**
   - Click **Create**
   - ⚠️ **IMPORTANT**: Copy the token immediately (shown only once!)
   - Save it temporarily in a secure location

## Step 2: Add Secret to GitHub Repository

1. **Navigate to Repository Settings**
   - Go to: https://github.com/liubai01/IntelligentMarkdown/settings/secrets/actions
   - Or: Repository → Settings → Secrets and variables → Actions

2. **Create New Secret**
   - Click **New repository secret**
   - **Name**: `VSCE_PAT` (must be exactly this name)
   - **Value**: Paste your PAT token from Step 1
   - Click **Add secret**

3. **Verify Secret**
   - You should see `VSCE_PAT` in the list of secrets
   - The value will be hidden (shown as `***`)

## Step 3: Verify GitHub Actions Permissions

1. **Check Workflow Permissions**
   - Go to: https://github.com/liubai01/IntelligentMarkdown/settings/actions
   - Or: Repository → Settings → Actions → General

2. **Set Permissions**
   - Under "Workflow permissions"
   - Select: ✅ **Read and write permissions**
   - Check: ✅ **Allow GitHub Actions to create and approve pull requests**
   - Click **Save**

## Step 4: Test the Workflow

Now test the automated release:

```bash
# 1. Update version in package.json (e.g., 0.4.1 → 0.4.2)

# 2. Commit and push
git add package.json
git commit -m "chore: bump version to 0.4.2"
git push origin master

# 3. Create and push tag (this triggers the workflow)
git tag v0.4.2
git push origin v0.4.2
```

## Step 5: Monitor First Release

1. **Watch GitHub Actions**
   - Go to: https://github.com/liubai01/IntelligentMarkdown/actions
   - You should see "Publish Extension" workflow running
   - Click on it to view logs

2. **Verify Success**
   - Workflow should complete with green checkmark ✅
   - Check: https://github.com/liubai01/IntelligentMarkdown/releases
   - New release should be created with .vsix file attached

3. **Check Marketplace** (wait 5-10 minutes)
   - Visit: https://marketplace.visualstudio.com/items?itemName=liubai01.config-md
   - Verify new version is live

## Troubleshooting

### Error: "Resource not authorized"

**Cause**: PAT token doesn't have correct permissions or expired

**Solution**:
1. Create new PAT with **Marketplace (Manage)** scope
2. Update GitHub secret `VSCE_PAT` with new token

### Error: "Version already exists"

**Cause**: Version in package.json already published

**Solution**:
1. Bump version number in package.json
2. Commit and create new tag

### Workflow doesn't trigger

**Cause**: Tag format incorrect or Actions disabled

**Solution**:
1. Ensure tag starts with 'v' (e.g., `v0.4.2`)
2. Check Actions are enabled in repository settings
3. Verify workflow file exists: `.github/workflows/publish.yml`

### Error: "Permission denied to create release"

**Cause**: GitHub Actions doesn't have write permissions

**Solution**:
1. Go to repository Settings → Actions → General
2. Enable "Read and write permissions"
3. Re-run the workflow

## Security Best Practices

✅ **DO**:
- Store PAT in GitHub Secrets only
- Use minimal required permissions (Marketplace: Manage)
- Set reasonable expiration dates
- Revoke old tokens when creating new ones

❌ **DON'T**:
- Commit PAT to code repository
- Share PAT in public channels
- Use tokens with excessive permissions
- Leave expired tokens in GitHub Secrets

## Maintenance

### When PAT Expires

1. Create new PAT (follow Step 1)
2. Update GitHub Secret (follow Step 2)
3. No code changes needed!

### Updating the Workflow

Edit `.github/workflows/publish.yml` to customize:
- Node.js version
- Build steps
- Release notes format
- Notification methods

## Quick Links

- **Repository Secrets**: https://github.com/liubai01/IntelligentMarkdown/settings/secrets/actions
- **Actions Settings**: https://github.com/liubai01/IntelligentMarkdown/settings/actions
- **Workflow Runs**: https://github.com/liubai01/IntelligentMarkdown/actions
- **Azure DevOps PAT**: https://dev.azure.com/ → User Settings → Personal Access Tokens
- **Marketplace Dashboard**: https://marketplace.visualstudio.com/manage/publishers/liubai01

## Summary

After completing this setup once:

1. ✅ GitHub Actions workflow is configured
2. ✅ PAT token is securely stored
3. ✅ Permissions are set correctly
4. ✅ Future releases are fully automated

**To release**: Just push a git tag! 🚀

```bash
git tag v0.4.2
git push origin v0.4.2
```

That's it! GitHub Actions handles everything else.
