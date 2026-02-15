# Release Wizard

This wizard helps you publish a new version of the IntelligentMarkdown extension.

It will:
1. Update the version in `package.json`
2. Commit the version bump
3. Create and push a git tag
4. GitHub Actions will then automatically publish to the VS Code Marketplace

```lua-wizard
file: ./../../package.json
action: run
label: Publish New Version
icon: 🚀
cwd: ./../..
variables:
  current_version:
    type: json
    file: ./../../package.json
    path: version
commands: |
  npm version {{version}} --no-git-tag-version
  git add package.json package-lock.json
  git commit -m "chore: bump version to {{version}}"
  git push origin master
  git tag v{{version}}
  git push origin v{{version}}
steps:
  - field: version
    label: New Version
    type: string
    default: "{{current_version}}"
    description: "Enter the new version number. Current version: {{current_version}}"
    required: true
```

## What Happens After Release

When you push a tag (e.g., `v0.5.3`):

1. ✅ GitHub Actions triggers
2. ✅ Runs all tests
3. ✅ Compiles production build
4. ✅ Packages extension (.vsix)
5. ✅ Publishes to VS Code Marketplace
6. ✅ Creates GitHub Release with notes

**Wait 5-10 minutes** → New version live on Marketplace!
