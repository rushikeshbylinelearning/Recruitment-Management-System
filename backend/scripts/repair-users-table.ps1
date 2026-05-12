# PowerShell script to repair crashed users table
Write-Host "🔧 MySQL Table Repair Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# Load environment variables from .env file
$envFile = Join-Path $PSScriptRoot "..\..\.env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

$dbHost = if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }
$dbUser = if ($env:DB_USER) { $env:DB_USER } else { "root" }
$dbPassword = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { "" }
$dbName = if ($env:DB_NAME) { $env:DB_NAME } else { "hr_workflow" }

Write-Host "`nDatabase Configuration:" -ForegroundColor Yellow
Write-Host "  Host: $dbHost"
Write-Host "  User: $dbUser"
Write-Host "  Database: $dbName"
Write-Host ""

# Check if mysql command is available
$mysqlPath = Get-Command mysql -ErrorAction SilentlyContinue

if (-not $mysqlPath) {
    Write-Host "❌ MySQL command line tool not found in PATH" -ForegroundColor Red
    Write-Host "`nPlease ensure MySQL is installed and added to your PATH, or run this SQL manually:" -ForegroundColor Yellow
    Write-Host "  USE $dbName;" -ForegroundColor White
    Write-Host "  REPAIR TABLE users;" -ForegroundColor White
    Write-Host "  OPTIMIZE TABLE users;" -ForegroundColor White
    exit 1
}

Write-Host "✅ MySQL command found at: $($mysqlPath.Source)" -ForegroundColor Green

# Create SQL commands
$sqlCommands = @"
USE $dbName;
REPAIR TABLE users;
OPTIMIZE TABLE users;
SELECT 'Table repair completed' as Status;
"@

# Execute repair
Write-Host "`n🔧 Executing table repair..." -ForegroundColor Cyan

try {
    if ($dbPassword) {
        $sqlCommands | mysql -h $dbHost -u $dbUser -p$dbPassword 2>&1
    } else {
        $sqlCommands | mysql -h $dbHost -u $dbUser 2>&1
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Table repair completed successfully!" -ForegroundColor Green
        Write-Host "`nYou can now restart your Node.js server." -ForegroundColor Cyan
    } else {
        Write-Host "`n⚠️ Repair command executed but may have encountered issues." -ForegroundColor Yellow
        Write-Host "Check the output above for details." -ForegroundColor Yellow
    }
} catch {
    Write-Host "`n❌ Error executing repair: $_" -ForegroundColor Red
    Write-Host "`nTry running these commands manually in MySQL:" -ForegroundColor Yellow
    Write-Host "  USE $dbName;" -ForegroundColor White
    Write-Host "  REPAIR TABLE users;" -ForegroundColor White
    Write-Host "  OPTIMIZE TABLE users;" -ForegroundColor White
    exit 1
}
