# Avvia Music Multi-Agent System (Windows)

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "=== Music Multi-Agent System ===" -ForegroundColor Cyan

# 1. Ollama
$ollamaRunning = Get-Process -Name "ollama" -ErrorAction SilentlyContinue
if ($ollamaRunning) {
    Write-Host "✓ Ollama gia' in esecuzione" -ForegroundColor Green
} else {
    Write-Host "→ Avvio Ollama..." -ForegroundColor Yellow
    Start-Process "ollama" -ArgumentList "serve" -WindowStyle Normal
    Start-Sleep 2
}

# 2. Backend (uvicorn)
Write-Host "→ Avvio Backend..." -ForegroundColor Yellow
$backendScript = @"
cd '$Root'
& '$Root\backend\.venv\Scripts\python.exe' -m uvicorn backend.main:app --port 8000
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendScript

Start-Sleep 2

# 3. Frontend (Vite)
Write-Host "→ Avvio Frontend..." -ForegroundColor Yellow
$frontendScript = @"
cd '$Root\frontend'
npm run dev
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendScript

# 4. Apri il browser dopo che i server sono pronti
Write-Host "→ Attendo avvio server..." -ForegroundColor Yellow
Start-Sleep 6
Start-Process "http://localhost:5173"

Write-Host "✓ Fatto! Browser aperto su http://localhost:5173" -ForegroundColor Green
