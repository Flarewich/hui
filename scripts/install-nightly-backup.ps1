param(
  [string]$TaskName = "TurniryNightlyBackup",
  [string]$ProjectPath = (Get-Location).Path,
  [string]$RunAt = "03:30"
)

$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $ProjectPath "scripts\\backup-db.ps1"
if (-not (Test-Path $scriptPath)) {
  throw "Backup script not found: $scriptPath"
}

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -Daily -At $RunAt
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Description "Nightly PostgreSQL backup for Turniry" -Force | Out-Null

Write-Host "Scheduled task '$TaskName' installed. It will run daily at $RunAt."
