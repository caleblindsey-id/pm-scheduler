# PM Scheduler - Nightly Equipment-Sale Lead Candidate Scan Runner
# Run this script via Windows Task Scheduler at 5:35 AM daily (after validation at 5:30 AM)

$ErrorActionPreference = "Stop"
$scriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent (Split-Path -Parent $scriptDir)

# ----------------------------------------------------------------
# Create logs directory if it doesn't exist
# ----------------------------------------------------------------
$logsDir = Join-Path $projectRoot "logs"
if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir | Out-Null
}

# ----------------------------------------------------------------
# Environment variables
# ----------------------------------------------------------------
$env:SUPABASE_URL              = "https://haohkybnmnpuxpiykjvb.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhhb2hreWJubW5wdXhwaXlranZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzg2MjA1NywiZXhwIjoyMDg5NDM4MDU3fQ.uw_t_dKzlQPctD3yS2M6qgHSr9FjHHzMvRzMb61OXOM"

# ----------------------------------------------------------------
# Run the scan script
# The Python script manages its own log file in logs/scan-equipment-sale-YYYY-MM-DD.log
# ----------------------------------------------------------------
$pythonExe  = "C:\Users\Caleb Lindsey\AppData\Local\Python\pythoncore-3.14-64\python.exe"
$scanScript = Join-Path $scriptDir "scan-equipment-sale-candidates.py"

Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') Starting equipment-sale lead candidate scan..."

& $pythonExe $scanScript

$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
    Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') Scan finished with exit code $exitCode (check log for details)."
    exit $exitCode
} else {
    Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') Scan completed successfully."
    exit 0
}
