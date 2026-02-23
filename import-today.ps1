# Cognitive-OS 批量导入脚本
# 在 PowerShell 中运行

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Cognitive-OS 批量导入" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan

# 导入今天的
Write-Host ""
Write-Host "📥 导入今天的 sessions..." -ForegroundColor Yellow
node core\auto-importer.js --today

Write-Host ""
Write-Host "📊 生成偏好报告..." -ForegroundColor Yellow
node core\auto-importer.js --stats

Write-Host ""
Write-Host "🧠 生成认知报告..." -ForegroundColor Yellow
node core\bootstrap.js

Write-Host ""
Write-Host "═══════════════════════════════════════" -ForegroundColor Green
Write-Host "✅ 全部完成！" -ForegroundColor Green
Write-Host "═══════════════════════════════════════" -ForegroundColor Green
