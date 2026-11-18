$rootDir = "C:\Users\tejas\OneDrive\Desktop\WHTSAP utomation"
Set-Location $rootDir

Write-Host "Killing any old processes on 8000 / 3001..." -ForegroundColor Yellow
$oldProcesses = Get-NetTCPConnection -LocalPort 8000, 3001 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($p in $oldProcesses) {
    if ($p -gt 4) {
        Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
    }
}
Get-Process -Name "ngrok" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Start-Sleep -Seconds 1

Write-Host "1. Starting FastAPI Backend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$rootDir'; `$env:PYTHONPATH='backend'; python -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000"

Start-Sleep -Seconds 2

Write-Host "2. Starting WhatsApp Gateway..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$rootDir\whatsapp-gateway'; node server.js"

Start-Sleep -Seconds 2

Write-Host "3. Starting Ngrok Tunnel..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& 'C:\Users\tejas\AppData\Roaming\npm\node_modules\ngrok\bin\ngrok.exe' http 3001 --url flatware-shortwave-landside.ngrok-free.dev"

Start-Sleep -Seconds 4
Write-Host "Checking service health..." -ForegroundColor Green
try {
    $gw = Invoke-RestMethod -Uri "http://127.0.0.1:3001/api/status/s0000001-0000-0000-0000-000000000001" -TimeoutSec 3
    Write-Host "Gateway status: $($gw.status) ($($gw.phone))" -ForegroundColor Green
} catch {
    Write-Host "Gateway check failed: $_" -ForegroundColor Red
}

try {
    $be = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -TimeoutSec 3
    Write-Host "Backend health: $($be.status)" -ForegroundColor Green
} catch {
    Write-Host "Backend check failed: $_" -ForegroundColor Red
}

