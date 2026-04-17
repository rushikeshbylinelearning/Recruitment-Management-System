# Fix corrupted interaction tables
Write-Host ""
Write-Host "Fixing corrupted interaction tables..." -ForegroundColor Cyan
Write-Host ""

# MySQL data directory
$dataDir = "C:\xampp\mysql\data\hr_workflow_db\"
$filesToDelete = @(
    "interaction_candidates.ibd",
    "interaction_notes.ibd",
    "interaction_pipeline.ibd"
)

# Step 1: Stop MySQL
Write-Host "Step 1: Stopping MySQL..." -ForegroundColor Yellow
try {
    Stop-Process -Name "mysqld" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "[OK] MySQL stopped" -ForegroundColor Green
} catch {
    Write-Host "[WARNING] Could not stop MySQL process. Please stop it manually from XAMPP Control Panel." -ForegroundColor Red
    Write-Host "Press Enter after stopping MySQL..." -ForegroundColor Yellow
    Read-Host
}

# Step 2: Delete orphaned files
Write-Host ""
Write-Host "Step 2: Deleting orphaned tablespace files..." -ForegroundColor Yellow
foreach ($file in $filesToDelete) {
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
}

# Step 3: Start MySQL
Write-Host ""
Write-Host "Step 3: Starting MySQL..." -ForegroundColor Yellow
Write-Host "Please start MySQL from XAMPP Control Panel" -ForegroundColor Cyan
Write-Host "Press Enter after starting MySQL..." -ForegroundColor Yellow
Read-Host

# Step 4: Recreate tables
Write-Host ""
Write-Host "Step 4: Recreating tables..." -ForegroundColor Yellow
Set-Location -Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
node backend/scripts/recreate-interaction-tables.js

Write-Host ""
Write-Host "[SUCCESS] Fix process completed!" -ForegroundColor Green
Write-Host "Your server should now work without errors." -ForegroundColor Cyan
Write-Host ""
