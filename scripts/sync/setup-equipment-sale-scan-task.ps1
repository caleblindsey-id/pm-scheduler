# PM Scheduler - Register Equipment-Sale Lead Candidate Scan in Task Scheduler
# Run once to set up the nightly scan job.

$taskName    = "PM Scheduler - Equipment Sale Scan"
$description = "Nightly scan of Synergy for equipment-sale lead candidate matches + 90-day expiration sweep on tech_leads"
$scriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$runScript   = Join-Path $scriptDir "run-equipment-sale-scan.ps1"

# Schedule: daily at 5:35 AM (5 min after validation, 35 min after sync)
$trigger = New-ScheduledTaskTrigger -Daily -At "05:35AM"

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -File `"$runScript`"" `
    -WorkingDirectory $scriptDir

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 15)

# Remove existing task if present
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "Removed existing task '$taskName'."
}

Register-ScheduledTask `
    -TaskName $taskName `
    -Description $description `
    -Trigger $trigger `
    -Action $action `
    -Settings $settings `
    -User $env:USERNAME

Write-Host "Task '$taskName' registered successfully - runs daily at 5:35 AM."
