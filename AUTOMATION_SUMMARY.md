# 🤖 自动化发布系统总结

## ✅ 已完成配置

### 1. 文档系统
- ✅ `docs/QUICK_RELEASE.md` - 快速发布指南（4条命令搞定）
- ✅ `docs/RELEASE.md` - 完整发布流程和规范
- ✅ `docs/SETUP_GITHUB_ACTIONS.md` - GitHub Actions 一次性配置指南
- ✅ `docs/README.md` - 文档索引
- ✅ `.github/RELEASE_CHECKLIST.md` - 发布检查清单

### 2. GitHub Actions 工作流
- ✅ `.github/workflows/publish.yml` - 自动发布工作流
- ✅ 触发器：推送 `v*` 格式的 tag
- ✅ 自动执行：测试 → 编译 → 打包 → 发布 → 创建 Release

### 3. 安全配置
- ✅ `.vscode-pat` 已添加到 `.gitignore`
- ✅ `.vscodeignore` 排除敏感文件
- ✅ PAT 通过 GitHub Secrets 安全存储

### 4. Git 标签
- ✅ 已为当前版本创建 tag: `v0.4.1`

## 🔧 需要你完成的一次性配置

### 配置 GitHub Secret（5分钟）

**重要**：这是启用自动化的唯一必需步骤！

1. **创建 Azure DevOps PAT**
   - 访问：https://dev.azure.com/
   - 用户设置 → Personal Access Tokens → New Token
   - 权限：Marketplace (Manage) ✅
   - 复制生成的 token

2. **添加到 GitHub**
   - 访问：https://github.com/liubai01/IntelligentMarkdown/settings/secrets/actions
   - New repository secret
   - Name: `VSCE_PAT`
   - Value: 粘贴你的 PAT
   - Add secret

3. **验证权限**
   - 访问：https://github.com/liubai01/IntelligentMarkdown/settings/actions
   - 确保启用 "Read and write permissions"

**详细步骤**：参见 `docs/SETUP_GITHUB_ACTIONS.md`

## 🚀 未来发布流程（超简单！）

完成上述配置后，以后发布只需：

```bash
# 1. 修改 package.json 中的版本号（例如：0.4.1 → 0.4.2）

# 2. 运行这4条命令
npm test
git add package.json
git commit -m "chore: bump version to 0.4.2"
git push origin master
git tag v0.4.2
git push origin v0.4.2

# ✅ 完成！GitHub Actions 自动处理剩余所有步骤
```

### 自动化流程

推送 tag 后，GitHub Actions 自动：

1. ✅ 运行所有测试
2. ✅ 编译生产版本
3. ✅ 打包扩展 (.vsix)
4. ✅ 发布到 VS Code Marketplace
5. ✅ 创建 GitHub Release（附带 .vsix 文件）
6. ✅ 生成 Release Notes

**等待 5-10 分钟** → 新版本在 Marketplace 上线！

## 📊 监控和验证

发布后检查：

- **GitHub Actions**: https://github.com/liubai01/IntelligentMarkdown/actions
- **GitHub Releases**: https://github.com/liubai01/IntelligentMarkdown/releases
- **Marketplace**: https://marketplace.visualstudio.com/items?itemName=liubai01.config-md

## 🎯 给 AI 助手的提示

当帮助发布时：

1. ✅ 阅读 `docs/QUICK_RELEASE.md` 了解标准流程
2. ✅ 更新 `package.json` 版本号
3. ✅ 运行测试确保通过
4. ✅ 提交版本变更
5. ✅ **创建并推送 git tag**（这是触发自动化的关键！）
6. ✅ 监控 GitHub Actions 工作流
7. ❌ 永远不要暴露或提交 PAT token
8. ❌ 不需要手动运行 `vsce publish`（自动化会处理）

## 📝 版本号规范

遵循 [语义化版本](https://semver.org/)：

- **补丁版本** (0.0.x)：Bug 修复 → `0.4.1` → `0.4.2`
- **次版本** (0.x.0)：新功能（向后兼容）→ `0.4.2` → `0.5.0`
- **主版本** (x.0.0)：破坏性变更 → `0.5.0` → `1.0.0`

## 🔒 安全最佳实践

- ✅ PAT 存储在 GitHub Secrets
- ✅ `.vscode-pat` 仅用于本地开发（已 git-ignored）
- ✅ `.vscodeignore` 排除敏感文件
- ✅ PAT 设置合理的过期时间
- ❌ 永远不要提交 token 到代码库

## 🆘 常见问题

| 问题 | 解决方案 |
|------|----------|
| 工作流未触发 | 确保 tag 格式为 `vX.Y.Z`（带 v 前缀） |
| PAT 过期 | 在 Azure DevOps 创建新 token，更新 GitHub Secret |
| 版本已存在 | 增加版本号并重新 tag |
| 权限错误 | 检查 GitHub Actions 权限设置 |

## 📚 完整文档

- **快速指南**: `docs/QUICK_RELEASE.md`
- **完整流程**: `docs/RELEASE.md`
- **配置指南**: `docs/SETUP_GITHUB_ACTIONS.md`
- **检查清单**: `.github/RELEASE_CHECKLIST.md`
- **文档索引**: `docs/README.md`

## 🎉 总结

**一次配置，终身受益！**

完成 GitHub Secret 配置后，以后每次发布只需：
1. 改版本号
2. 推送 tag

就这么简单！🚀

---

**下一步**：按照 `docs/SETUP_GITHUB_ACTIONS.md` 完成 GitHub Secret 配置
