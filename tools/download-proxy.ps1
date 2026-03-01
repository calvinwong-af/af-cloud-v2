# Cloud SQL Auth Proxy — Local Development
#
# The proxy binary is NOT committed to the repo (it's large and platform-specific).
# Run this script once to download it, then use start-proxy.bat to run it.
#
# Usage (from repo root):
#   powershell -ExecutionPolicy Bypass -File tools\download-proxy.ps1

$version = "v2.21.1"
$url = "https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/$version/cloud-sql-proxy.x64.exe"
$dest = "$PSScriptRoot\cloud-sql-proxy.exe"

if (Test-Path $dest) {
    Write-Host "cloud-sql-proxy.exe already exists at $dest. Delete it first to re-download." -ForegroundColor Yellow
    exit 0
}

Write-Host "Downloading Cloud SQL Auth Proxy $version..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $url -OutFile $dest
Write-Host "Done. Run tools\start-proxy.bat to start the proxy." -ForegroundColor Green
