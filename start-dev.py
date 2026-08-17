# ============================================================
# YoungCreative — Script Startup Development (tanpa Docker)
# Jalankan sebagai Administrator: .\start-dev.ps1
# ============================================================

param(
    [switch]$NoQuality   # Jalankan tanpa photo-quality-service (jika Python belum ada)
)

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  YoungCreative — Starting Dev Services" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. MinIO ──────────────────────────────────────────────────
Write-Host "[1/4] Starting MinIO Object Storage (port 9000/9001)..." -ForegroundColor Yellow
$env:MINIO_ROOT_USER     = "minioadmin"
$env:MINIO_ROOT_PASSWORD = "minioadmin123"
New-Item -ItemType Directory -Force -Path "C:\minio\data" | Out-Null
Start-Process -FilePath "C:\Users\Administrator\AppData\Local\Microsoft\WinGet\Links\minio.exe" `
    -ArgumentList "server C:\minio\data --console-address :9001" `
    -WindowStyle Minimized
Start-Sleep -Seconds 3

# ── 2. Backend API ────────────────────────────────────────────
Write-Host "[2/4] Starting Backend API (port 4000)..." -ForegroundColor Yellow
$backendPath = "c:\laragon\www\youngscreative\backend"
Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; npm run dev" `
    -WindowStyle Normal
Start-Sleep -Seconds 2

# ── 3. Image Proxy ────────────────────────────────────────────
Write-Host "[3/4] Starting Image Proxy (port 5000)..." -ForegroundColor Yellow
$proxyPath = "c:\laragon\www\youngscreative\image-proxy"
Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoExit", "-Command", "cd '$proxyPath'; npm run dev" `
    -WindowStyle Normal
Start-Sleep -Seconds 2

# ── 4. Photo Quality Service (Python) ────────────────────────
$pythonPath = "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe"
$venvPath   = "c:\laragon\www\youngscreative\photo-quality-service\venv\Scripts\python.exe"
$qualityPath = "c:\laragon\www\youngscreative\photo-quality-service"

if ($NoQuality) {
    Write-Host "[4/4] Photo Quality Service dilewati (-NoQuality)." -ForegroundColor Gray
} elseif (Test-Path $venvPath) {
    Write-Host "[4/4] Starting Photo Quality Service (port 6000)..." -ForegroundColor Yellow
    Start-Process -FilePath "powershell.exe" `
        -ArgumentList "-NoExit", "-Command", "cd '$qualityPath'; .\venv\Scripts\Activate.ps1; uvicorn app.main:app --host 0.0.0.0 --port 6000 --reload" `
        -WindowStyle Normal
    Start-Sleep -Seconds 2
} elseif (Test-Path $pythonPath) {
    Write-Host "[4/4] Setup + Starting Photo Quality Service (port 6000)..." -ForegroundColor Yellow
    Start-Process -FilePath "powershell.exe" `
        -ArgumentList "-NoExit", "-Command", @"
cd '$qualityPath';
if (!(Test-Path 'venv')) {
    Write-Host 'Membuat virtual environment...' -ForegroundColor Cyan;
    & '$pythonPath' -m venv venv;
}
.\venv\Scripts\Activate.ps1;
Write-Host 'Installing dependencies (bisa 5-10 menit pertama kali)...' -ForegroundColor Cyan;
pip install -r requirements.txt -q;
Write-Host 'Menjalankan service...' -ForegroundColor Green;
uvicorn app.main:app --host 0.0.0.0 --port 6000 --reload
"@ `
        -WindowStyle Normal
} else {
    Write-Host "[4/4] SKIP: Python tidak ditemukan. Jalankan secara manual:" -ForegroundColor DarkYellow
    Write-Host "      winget install Python.Python.3.11" -ForegroundColor Gray
    Write-Host "      Lalu jalankan lagi script ini." -ForegroundColor Gray
}

# ── 5. Frontend React ─────────────────────────────────────────
Write-Host "[5/5] Starting Frontend React (port 3000)..." -ForegroundColor Yellow
$frontendPath = "c:\laragon\www\youngscreative\frontend"
Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; npm run dev" `
    -WindowStyle Normal

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Semua layanan sedang starting..." -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend      : http://localhost:3000" -ForegroundColor White
Write-Host "  Backend API   : http://localhost:4000/health" -ForegroundColor White
Write-Host "  Image Proxy   : http://localhost:5000/health" -ForegroundColor White
Write-Host "  Quality Svc   : http://localhost:6000/health" -ForegroundColor White
Write-Host "  MinIO Console : http://localhost:9001" -ForegroundColor White
Write-Host ""
Write-Host "  Login Demo    : fotografer@demo.com / password123" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Tunggu ~10 detik lalu buka http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
