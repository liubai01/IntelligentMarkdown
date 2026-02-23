# config.md 扩展一键安装脚本
# 自动编译、打包并安装最新版本的扩展

Write-Host "🚀 开始安装 config.md 扩展..." -ForegroundColor Cyan

# 检查是否在项目根目录
if (-not (Test-Path "package.json")) {
    Write-Host "❌ 错误: 请在项目根目录运行此脚本" -ForegroundColor Red
    exit 1
}

# 1. 编译项目
Write-Host "`n📦 步骤 1/4: 编译项目..." -ForegroundColor Yellow
npm run compile
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 编译失败" -ForegroundColor Red
    exit 1
}

# 2. 打包扩展
Write-Host "`n📦 步骤 2/4: 打包扩展..." -ForegroundColor Yellow
npx @vscode/vsce package --no-git-tag-version
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 打包失败" -ForegroundColor Red
    exit 1
}

# 3. 清理旧版本并重命名
Write-Host "`n🧹 步骤 3/4: 清理旧版本..." -ForegroundColor Yellow
$oldVersions = Get-ChildItem -Path "." -Filter "config-md-*.vsix" -ErrorAction SilentlyContinue
foreach ($file in $oldVersions) {
    if ($file.Name -ne "latest.vsix") {
        Remove-Item $file.FullName -Force
        Write-Host "   删除: $($file.Name)" -ForegroundColor Gray
    }
}

# 获取最新生成的 .vsix 文件
$latestVsix = Get-ChildItem -Path "." -Filter "config-md-*.vsix" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($latestVsix) {
    Move-Item -Path $latestVsix.FullName -Destination "latest.vsix" -Force
    Write-Host "   ✅ 已重命名为: latest.vsix" -ForegroundColor Green
}

# 4. 安装扩展
Write-Host "`n📥 步骤 4/4: 安装扩展..." -ForegroundColor Yellow
if (Test-Path "latest.vsix") {
    cursor --install-extension latest.vsix --force
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ 安装成功！" -ForegroundColor Green
        Write-Host "   请重新加载 Cursor 窗口以激活扩展" -ForegroundColor Cyan
        Write-Host "   按 Ctrl+Shift+P，输入 'Reload Window' 并执行" -ForegroundColor Cyan
    } else {
        Write-Host "❌ 安装失败" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ 未找到 latest.vsix 文件" -ForegroundColor Red
    exit 1
}

Write-Host "`n🎉 完成！" -ForegroundColor Green
