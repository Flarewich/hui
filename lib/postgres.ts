import { Client, Pool, type PoolClient, type QueryResultRow } from "pg";

declare global {
  var __turniryPgPool: Pool | undefined;
}

function envNumber(name: string, fallback: number) {
  const raw = process.env[name];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envBool(name: string, fallback: boolean) {
  const raw = process.env[name];
  if (!raw) return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

function getPgConfig() {
  const connectionString = process.env.DATABASE_URL;
  const useSsl = process.env.PGSSLMODE === "require" || envBool("PGSSL", false);

  return {
    connectionString,
    host: connectionString ? undefined : process.env.PGHOST ?? "localhost",
    port: connectionString ? undefined : envNumber("PGPORT", 5432),
    database: connectionString ? undefined : process.env.PGDATABASE ?? "appdb",
    user: connectionString ? undefined : process.env.PGUSER ?? "postgres",
    password: connectionString ? undefined : process.env.PGPASSWORD ?? "postgres",
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  };
}

function createPool() {
  return new Pool({
    ...getPgConfig(),
    max: envNumber("PGPOOL_MAX", 10),
  });
}

export const postgres =
  globalThis.__turniryPgPool ?? (globalThis.__turniryPgPool = createPool());

export async function pgQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
) {
  return postgres.query<T>(text, params);
}

export async function pgRows<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
) {
  const result = await pgQuery<T>(text, params);
  return result.rows;
}

export async function pgOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
) {
  const rows = await pgRows<T>(text, params);
  if (rows.length === 0) {
    throw new Error("Expected one row, got none");
  }
  return rows[0];
}

export async function pgMaybeOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
) {
  const rows = await pgRows<T>(text, params);
  return rows[0] ?? null;
}

export async function withPgTransaction<T>(fn: (client: PoolClient) => Promise<T>) {
  const client = await postgres.connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export function createPgClient() {
  return new Client(getPgConfig());
}
