# One-Click Deploy

Deploy the latest development version to Cursor editor.

## 🚀 Deploy Wizard

Open the preview panel (📖) and complete the wizard to generate the deploy command:

```lua-wizard
file: ./deploy_script.lua
target: DeployScript
action: append
label: Deploy Extension
icon: 🚀
template: |
  -- Deploy: {{timestamp}}
  -- Command: .\install.ps1
steps:
  - field: confirm
    label: Deploy Latest Version
    type: boolean
    default: true
    description: Build, package, and install the latest development version
```

**After completing the wizard, run in PowerShell:**

```powershell
.\install.ps1
```

---

**Tip**: Press `Ctrl+Shift+P` → `Tasks: Run Task` → `Deploy Extension` to deploy directly from Cursor.
