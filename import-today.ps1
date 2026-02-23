# Cognitive-OS Batch Import Script
# Run in PowerShell

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$Separator = "---------------------------------------"

Write-Host $Separator -ForegroundColor Cyan
Write-Host "Cognitive-OS Batch Import" -ForegroundColor Cyan
Write-Host $Separator -ForegroundColor Cyan

# Import today's sessions
Write-Host ""
Write-Host "[Import] Importing today's sessions..." -ForegroundColor Yellow
node core\auto-importer.js --today

Write-Host ""
Write-Host "[Stats] Generating preference report..." -ForegroundColor Yellow
node core\auto-importer.js --stats

Write-Host ""
Write-Host "[Cognitive] Generating cognitive report..." -ForegroundColor Yellow
node core\bootstrap.js

Write-Host ""
Write-Host "[Memory] Syncing long-term memory index..." -ForegroundColor Yellow
node core\memory-engine.js sync

Write-Host ""
Write-Host $Separator -ForegroundColor Green
Write-Host "Done!" -ForegroundColor Green
Write-Host $Separator -ForegroundColor Green
