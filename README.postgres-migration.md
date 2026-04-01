# PostgreSQL Local Runbook

This project now runs on plain PostgreSQL and no longer requires Supabase packages or Supabase env variables.

## 1. Start PostgreSQL

Primary option:

```powershell
docker compose up -d
```

Default Docker connection:

- host: `localhost`
- port: `5434`
- database: `appdb`
- user: `postgres`
- password: `postgres`

Current machine-specific fallback used during local verification:

- host: `127.0.0.1`
- port: `5435`

Use the fallback only if Docker Desktop port forwarding does not work on your machine.

## 2. Configure environment

```powershell
Copy-Item .env.example .env.local
```

Edit `.env.local` and point it to the PostgreSQL instance you actually use.

Example for Docker:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/appdb
PGHOST=localhost
PGPORT=5434
PGDATABASE=appdb
PGUSER=postgres
PGPASSWORD=postgres
PGSSLMODE=disable
```

## 3. Import database dump

Supported dump names in project root:

- `supabase.sql`
- `supabase.dump`

The filenames were kept for convenience during migration from the old platform.

### Windows

```powershell
.\scripts\restore-db.ps1
```

### Linux/macOS

```bash
chmod +x ./scripts/restore-db.sh
./scripts/restore-db.sh
```

## 4. Import troubleshooting

- `role does not exist`
  Use `pg_restore --no-owner --no-privileges` or remove ownership commands from the dump.
- `extension does not exist`
  Remove unsupported `CREATE EXTENSION` lines or install the extension in your local PostgreSQL.
- `schema auth does not exist`
  The dump contains compatibility objects from the old platform. Keep only app-owned tables if you want a clean import.
- `schema storage does not exist`
  Same case: remove old platform storage metadata from the dump if it is not needed.
- `must be owner of ...`
  Restore with `--no-owner`.

## 5. Connect with DBeaver

Create a PostgreSQL connection with:

- Host: `localhost`
- Port: `5434`
- Database: `appdb`
- Username: `postgres`
- Password: `postgres`

If Docker forwarding is broken on your machine, use `127.0.0.1:5435` instead.

## 6. Run the site

```powershell
npm.cmd install
npm.cmd run dev
```

Open:

- `http://localhost:3000`

## 7. Local admin for dev

During local verification, this account was created:

- email: `admin@local.test`
- password: `Admin123!`

If you re-import a clean database, recreate the account or register a new admin through the local auth tables.
