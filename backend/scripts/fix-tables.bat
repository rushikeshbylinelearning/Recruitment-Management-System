@echo off
echo.
echo ========================================
echo   MySQL Table Fix Utility
echo ========================================
echo.
echo This will fix the corrupted tables by:
echo 1. Stopping MySQL
echo 2. Deleting orphaned files
echo 3. Restarting MySQL
echo 4. Recreating tables
echo.
echo Press Ctrl+C to cancel, or
pause

powershell.exe -ExecutionPolicy Bypass -File "%~dp0auto-fix-tables.ps1"

pause
