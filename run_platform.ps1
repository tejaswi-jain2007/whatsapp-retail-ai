# =============================================================================
# Quick Startup Script for AI-Powered WhatsApp Retail Platform
# =============================================================================

# Always determine the project root directory
$rootDir = $PSScriptRoot
if (-not (Test-Path "$rootDir\backend")) {
    $rootDir = Split-Path -Parent $PSScriptRoot
}

Set-Location $rootDir

Write-Host "=====================================================" -ForegroundColor Green
Write-Host " Starting AI-Powered WhatsApp Retail Platform" -ForegroundColor Green
Write-Host " Root Directory: $rootDir" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green

# 1. Start Backend in its own window
Write-Host "`n[1/2] Launching Python FastAPI Backend on http://localhost:8000..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$rootDir'; `$env:PYTHONPATH='backend'; python -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000"

Start-Sleep -Seconds 2

# 2. Start Frontend
Write-Host "`n[2/2] Launching Next.js Shopkeeper Dashboard on http://localhost:3000..." -ForegroundColor Cyan
Set-Location "$rootDir\frontend"
npm run dev
