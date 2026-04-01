$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$sqlDump = Join-Path $projectRoot "supabase.sql"
$customDump = Join-Path $projectRoot "supabase.dump"

$dbHost = if ($env:PGHOST) { $env:PGHOST } else { "localhost" }
$dbPort = if ($env:PGPORT) { $env:PGPORT } else { "5434" }
$dbName = if ($env:PGDATABASE) { $env:PGDATABASE } else { "appdb" }
$dbUser = if ($env:PGUSER) { $env:PGUSER } else { "postgres" }
$dbPassword = if ($env:PGPASSWORD) { $env:PGPASSWORD } else { "postgres" }

function Write-Step($message) {
  Write-Host "==> $message"
}

function Ensure-Command($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Command '$name' not found. Install PostgreSQL client tools and retry."
  }
}

function Invoke-PsqlFile($filePath) {
  $env:PGPASSWORD = $dbPassword
  & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -v ON_ERROR_STOP=1 -f $filePath
}

function Invoke-PgRestoreFile($filePath) {
  $env:PGPASSWORD = $dbPassword
  & pg_restore `
    --host $dbHost `
    --port $dbPort `
    --username $dbUser `
    --dbname $dbName `
    --no-owner `
    --no-privileges `
    --clean `
    --if-exists `
    $filePath
}

Write-Step "Checking database client tools"
Ensure-Command "psql"

if (Test-Path $sqlDump) {
  Write-Step "Found supabase.sql, importing with psql"
  Invoke-PsqlFile $sqlDump
  Write-Host "Import completed from supabase.sql"
  exit 0
}

if (Test-Path $customDump) {
  Write-Step "Found supabase.dump, importing with pg_restore"
  Ensure-Command "pg_restore"
  Invoke-PgRestoreFile $customDump
  Write-Host "Import completed from supabase.dump"
  exit 0
}

Write-Host "No dump file found."
Write-Host "Place one of these files in the project root:"
Write-Host "  - supabase.sql"
Write-Host "  - supabase.dump"
Write-Host ""
Write-Host "Typical problems during import:"
Write-Host "  - role does not exist: re-run with --no-owner / create placeholder roles"
Write-Host "  - extension does not exist: comment unsupported CREATE EXTENSION or install extension locally"
Write-Host "  - schema auth/storage does not exist: remove Supabase-specific schema objects or create compatibility schemas"
Write-Host "  - must be owner of ... : use pg_restore --no-owner --no-privileges"
exit 1
