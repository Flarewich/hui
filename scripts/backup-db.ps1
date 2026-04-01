param(
  [string]$OutputDir = ".\\backups",
  [string]$ContainerName = "turniry-postgres",
  [string]$Database = $(if ($env:PGDATABASE) { $env:PGDATABASE } else { "appdb" }),
  [string]$User = $(if ($env:PGUSER) { $env:PGUSER } else { "postgres" }),
  [string]$Password = $(if ($env:PGPASSWORD) { $env:PGPASSWORD } else { "postgres" }),
  [string]$Host = $(if ($env:PGHOST) { $env:PGHOST } else { "127.0.0.1" }),
  [string]$Port = $(if ($env:PGPORT) { $env:PGPORT } else { "5435" })
)

$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$target = Join-Path $OutputDir "appdb_$timestamp.dump"

$docker = Get-Command docker -ErrorAction SilentlyContinue
if ($docker) {
  $containerExists = docker ps --format "{{.Names}}" | Select-String -SimpleMatch $ContainerName
  if ($containerExists) {
    Write-Host "Creating backup via Docker container $ContainerName..."
    docker exec $ContainerName sh -lc "PGPASSWORD='$Password' pg_dump -U '$User' -d '$Database' -Fc" > $target
    Write-Host "Backup created: $target"
    exit 0
  }
}

$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDump) {
  throw "pg_dump not found and Docker container '$ContainerName' is not running. Install PostgreSQL client tools or start Docker DB first."
}

Write-Host "Creating backup via local pg_dump..."
$env:PGPASSWORD = $Password
& $pgDump.Source -h $Host -p $Port -U $User -d $Database -Fc -f $target
Write-Host "Backup created: $target"
