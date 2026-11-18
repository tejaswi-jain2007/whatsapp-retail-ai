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

# 1. Start FastAPI Backend
Write-Host "`n[1/3] Launching Python FastAPI Backend on http://localhost:8000..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$rootDir'; `$env:PYTHONPATH='backend'; python -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000"

Start-Sleep -Seconds 2

# 2. Start WhatsApp Pairing Gateway (8-Digit Code Support)
Write-Host "`n[2/3] Launching WhatsApp Pairing Gateway on http://localhost:3001..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$rootDir\whatsapp-gateway'; node server.js"

Start-Sleep -Seconds 2

# 3. Start Frontend Dashboard
Write-Host "`n[3/3] Launching Next.js Shopkeeper Dashboard on http://localhost:3000..." -ForegroundColor Cyan
Set-Location "$rootDir\frontend"
npm run dev
