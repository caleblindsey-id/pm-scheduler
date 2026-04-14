# PM Scheduler — Nightly Synergy Order Validation Runner
# Run this script via Windows Task Scheduler at 5:30 AM daily (after the 5 AM sync)

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
# Run the validation script
# ----------------------------------------------------------------
$pythonExe  = "C:\Users\Caleb Lindsey\AppData\Local\Python\pythoncore-3.14-64\python.exe"
$valScript  = Join-Path $scriptDir "validate-synergy-orders.py"
$logFile    = Join-Path $logsDir "validation-$(Get-Date -Format 'yyyy-MM-dd').log"

Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') Starting Synergy order validation..." | Tee-Object -FilePath $logFile -Append

& $pythonExe $valScript 2>&1 | Tee-Object -FilePath $logFile -Append

$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
    Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') Validation finished with exit code $exitCode (check log for details)." | Tee-Object -FilePath $logFile -Append
    exit $exitCode
} else {
    Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') Validation completed successfully." | Tee-Object -FilePath $logFile -Append
    exit 0
}
