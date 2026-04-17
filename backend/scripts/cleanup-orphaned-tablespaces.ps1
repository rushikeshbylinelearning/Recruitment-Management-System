# PowerShell script to clean up orphaned MySQL tablespace files
# This script finds and deletes .ibd files for the forms tables

Write-Host "Searching for MySQL data directory..." -ForegroundColor Cyan

# Common MySQL data directory locations on Windows
$possiblePaths = @(
    "C:\ProgramData\MySQL\MySQL Server 8.0\Data\hr_workflow_db",
    "C:\ProgramData\MySQL\MySQL Server 8.4\Data\hr_workflow_db",
    "C:\Program Files\MySQL\MySQL Server 8.0\data\hr_workflow_db",
    "C:\xampp\mysql\data\hr_workflow_db",
    "C:\wamp64\bin\mysql\mysql8.0.31\data\hr_workflow_db",
    "$env:APPDATA\MySQL\data\hr_workflow_db"
)

$dataDir = $null
foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $dataDir = $path
        Write-Host "Found MySQL data directory: $dataDir" -ForegroundColor Green
        break
    }
}

if (-not $dataDir) {
    Write-Host "Could not find MySQL data directory automatically." -ForegroundColor Red
    Write-Host ""
    Write-Host "Please manually locate your MySQL data directory and delete these files:" -ForegroundColor Yellow
    Write-Host "  - forms.ibd"
    Write-Host "  - form_fields.ibd"
    Write-Host "  - form_submissions.ibd"
    Write-Host "  - form_field_mappings.ibd"
    Write-Host "  - form_analytics.ibd"
    Write-Host ""
    Write-Host "Then run: node backend/rename-forms-tables.js" -ForegroundColor Cyan
    exit 1
}

# List of orphaned tablespace files to delete
$orphanedFiles = @(
    "forms.ibd",
    "form_fields.ibd",
    "form_submissions.ibd",
    "form_field_mappings.ibd",
    "form_analytics.ibd",
    "workflows.ibd",
    "workflow_triggers.ibd",
    "workflow_conditions.ibd",
    "workflow_actions.ibd",
    "workflow_logs.ibd"
)

Write-Host ""
Write-Host "Deleting orphaned tablespace files..." -ForegroundColor Cyan

$deletedCount = 0
foreach ($file in $orphanedFiles) {
    $filePath = Join-Path $dataDir $file
    if (Test-Path $filePath) {
        try {
            Remove-Item $filePath -Force
            Write-Host "   Deleted $file" -ForegroundColor Green
            $deletedCount++
        } catch {
            Write-Host "   Failed to delete $file : $_" -ForegroundColor Red
            Write-Host "      Try running this script as Administrator" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   $file not found (already clean)" -ForegroundColor Gray
    }
}

Write-Host ""
if ($deletedCount -gt 0) {
    Write-Host "Deleted $deletedCount orphaned tablespace file(s)" -ForegroundColor Green
    Write-Host "Now run: node backend/rename-forms-tables.js" -ForegroundColor Cyan
} else {
    Write-Host "No orphaned files found - directory is clean" -ForegroundColor Green
    Write-Host "Now run: node backend/rename-forms-tables.js" -ForegroundColor Cyan
}
