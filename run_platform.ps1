# =============================================================================
# Quick Startup Script for AI-Powered WhatsApp Retail Platform
# =============================================================================

Write-Host "=====================================================" -ForegroundColor Green
Write-Host " Starting AI-Powered WhatsApp Retail Platform" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green

# 1. Start Backend in a background process
Write-Host "`n[1/2] Launching Python FastAPI Backend on http://localhost:8000..." -ForegroundColor Cyan
$env:PYTHONPATH = "backend"
$backendProcess = Start-Process python -ArgumentList "-m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000" -PassThru -NoNewWindow

Start-Sleep -Seconds 3

# 2. Start Frontend
Write-Host "`n[2/2] Launching Next.js Shopkeeper Dashboard on http://localhost:3000..." -ForegroundColor Cyan
Set-Location frontend
npm run dev
