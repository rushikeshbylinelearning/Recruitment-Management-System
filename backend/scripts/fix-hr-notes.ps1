# Fix corrupted hr_notes table
Write-Host ""
Write-Host "Fixing corrupted hr_notes table..." -ForegroundColor Cyan
Write-Host ""

$dataDir = "C:\xampp\mysql\data\hr_workflow_db\"
$file = "hr_notes.ibd"

# Step 1: Stop MySQL
Write-Host "Step 1: Stopping MySQL..." -ForegroundColor Yellow
try {
    Stop-Process -Name "mysqld" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "[OK] MySQL stopped" -ForegroundColor Green
} catch {
    Write-Host "[WARNING] Could not stop MySQL. Please stop it manually from XAMPP Control Panel." -ForegroundColor Red
    Write-Host "Press Enter after stopping MySQL..." -ForegroundColor Yellow
    Read-Host
}

# Step 2: Delete orphaned file
Write-Host ""
Write-Host "Step 2: Deleting orphaned tablespace file..." -ForegroundColor Yellow
$filePath = Join-Path $dataDir $file
if (Test-Path $filePath) {
    try {
        Remove-Item $filePath -Force
        Write-Host "[OK] Deleted: $file" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Failed to delete: $file - $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "[SKIP] File not found: $file" -ForegroundColor Yellow
}

# Step 3: Start MySQL
Write-Host ""
Write-Host "Step 3: Starting MySQL..." -ForegroundColor Yellow
Write-Host "Please start MySQL from XAMPP Control Panel" -ForegroundColor Cyan
Write-Host "Press Enter after starting MySQL..." -ForegroundColor Yellow
Read-Host

# Step 4: Recreate table
Write-Host ""
Write-Host "Step 4: Recreating table..." -ForegroundColor Yellow
Set-Location -Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
node backend/scripts/recreate-hr-notes.js

Write-Host ""
Write-Host "[SUCCESS] Fix completed!" -ForegroundColor Green
Write-Host ""
