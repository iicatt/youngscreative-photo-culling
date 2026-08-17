# ============================================================
# CFC (Culling Foto Creative) — Script Startup Development
# Jalankan sebagai Administrator: .\start-dev.ps1
# ============================================================

param(
    [switch]$NoQuality  # Skip photo-quality-service
)

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  CFC (Culling Foto Creative) — Starting Dev Services" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$rootPath    = "c:\laragon\www\youngscreative"
$minioExe    = "C:\minio\minio.exe"
$minioData   = "C:\minio\data"

# ── Helper: kill proses di port tertentu ─────────────────────
function Kill-Port([int]$port) {
    $lines = netstat -ano 2>$null | Select-String ":$port\s"
    foreach ($line in $lines) {
        if ($line -match '(\d+)\s*$') {
            $procId = $matches[1].Trim()
            if ($procId -match '^\d+$' -and [int]$procId -gt 0) {
                taskkill /PID $procId /F 2>$null | Out-Null
            }
        }
    }
}

# ── 1. MinIO ──────────────────────────────────────────────────
Write-Host "[1/5] MinIO Object Storage (port 9000/9001)..." -ForegroundColor Yellow
Kill-Port 9000; Kill-Port 9001
$env:MINIO_ROOT_USER     = "minioadmin"
$env:MINIO_ROOT_PASSWORD = "minioadmin123"
New-Item -ItemType Directory -Force -Path $minioData | Out-Null
Start-Process -FilePath $minioExe `
    -ArgumentList "server $minioData --address :9000 --console-address :9001" `
    -WindowStyle Minimized
Start-Sleep -Seconds 3
Write-Host "   MinIO OK → http://localhost:9000  |  Console: http://localhost:9001" -ForegroundColor Green

# ── 2. Backend API ────────────────────────────────────────────
Write-Host "[2/5] Backend API (port 4000)..." -ForegroundColor Yellow
Kill-Port 4000
Start-Process powershell -ArgumentList "-NoExit","-Command","cd '$rootPath\backend'; npm run dev" -WindowStyle Normal
Start-Sleep -Seconds 2

# ── 3. Image Proxy ────────────────────────────────────────────
Write-Host "[3/5] Image Proxy (port 5000)..." -ForegroundColor Yellow
Kill-Port 5000
Start-Process powershell -ArgumentList "-NoExit","-Command","cd '$rootPath\image-proxy'; npm run dev" -WindowStyle Normal
Start-Sleep -Seconds 2

# ── 4. Photo Quality Service (Python) ────────────────────────
$qualityPath = "$rootPath\photo-quality-service"
$venvPython  = "$qualityPath\venv\Scripts\python.exe"

if ($NoQuality) {
    Write-Host "[4/5] Photo Quality Service dilewati (-NoQuality)." -ForegroundColor Gray
} elseif (Test-Path $venvPython) {
    Write-Host "[4/5] Photo Quality Service (port 6000)..." -ForegroundColor Yellow
    Kill-Port 6000
    Start-Process powershell `
        -ArgumentList "-NoExit","-Command","cd '$qualityPath'; .\venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 6000" `
        -WindowStyle Normal
    Start-Sleep -Seconds 2
} else {
    Write-Host "[4/5] SKIP: Python venv tidak ditemukan di $qualityPath" -ForegroundColor DarkYellow
}

# ── 5. Frontend React ─────────────────────────────────────────
Write-Host "[5/5] Frontend React (port 3000)..." -ForegroundColor Yellow
Kill-Port 3000
Start-Process powershell -ArgumentList "-NoExit","-Command","cd '$rootPath\frontend'; npm run dev" -WindowStyle Normal

# ── Summary ───────────────────────────────────────────────────
Start-Sleep -Seconds 3
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Semua layanan dimulai!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend      : http://localhost:3000" -ForegroundColor White
Write-Host "  Backend API   : http://localhost:4000/health" -ForegroundColor White
Write-Host "  Image Proxy   : http://localhost:5000/health" -ForegroundColor White
Write-Host "  Quality Svc   : http://localhost:6000/health" -ForegroundColor White
Write-Host "  MinIO API     : http://localhost:9000" -ForegroundColor White
Write-Host "  MinIO Console : http://localhost:9001" -ForegroundColor White
Write-Host ""
Write-Host "  Login Demo    : fotografer@demo.com / password123" -ForegroundColor Cyan
Write-Host ""
