@echo off
:: Cloud SQL Auth Proxy — start for local development
:: Bridges localhost:5432 → Cloud SQL af-db (asia-northeast1)
::
:: Usage: double-click or run from any terminal
:: Keep this window open while developing locally.

set PROXY=%~dp0cloud-sql-proxy.exe

if not exist "%PROXY%" (
    echo cloud-sql-proxy.exe not found.
    echo Run this first:
    echo   powershell -ExecutionPolicy Bypass -File tools\download-proxy.ps1
    pause
    exit /b 1
)

echo Starting Cloud SQL Auth Proxy...
echo Connecting to: cloud-accele-freight:asia-northeast1:af-db
echo Listening on:  localhost:5432
echo.
echo Keep this window open while developing locally.
echo Press Ctrl+C to stop.
echo.

"%PROXY%" cloud-accele-freight:asia-northeast1:af-db --port 5432
