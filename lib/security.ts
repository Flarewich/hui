import { headers } from "next/headers";
import { pgOne, withPgTransaction } from "@/lib/postgres";

type RateLimitOptions = {
  action: string;
  key: string;
  limit: number;
  windowSeconds: number;
};

let ensuredSecurityTables = false;

function normalizeForwardedValue(value: string | null | undefined) {
  return String(value ?? "")
    .split(",")[0]
    .trim();
}

function normalizeOrigin(origin: string) {
  try {
    return new URL(origin).origin;
  } catch {
    return "";
  }
}

function getExpectedOriginFromHost(host: string | null | undefined, proto: string | null | undefined) {
  const normalizedHost = normalizeForwardedValue(host);
  if (!normalizedHost) return "";
  const normalizedProto = normalizeForwardedValue(proto) || (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${normalizedProto}://${normalizedHost}`;
}

function getExpectedRequestOrigin(request: Request) {
  const hostBasedOrigin = normalizeOrigin(
    getExpectedOriginFromHost(
      request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
      request.headers.get("x-forwarded-proto")
    )
  );

  if (hostBasedOrigin) return hostBasedOrigin;
  return normalizeOrigin(new URL(request.url).origin);
}

export function getSafeRequestOrigin(request: Request) {
  return (
    getExpectedRequestOrigin(request) ||
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://127.0.0.1:3000"
  );
}

export function getSafeRequestUrl(request: Request, path: string) {
  return new URL(path, getSafeRequestOrigin(request));
}

export async function ensureSecurityTables() {
  if (ensuredSecurityTables) return;

  await withPgTransaction(async (client) => {
    await client.query(`
      create table if not exists security_rate_limit_events (
        id bigserial primary key,
        action text not null,
        key text not null,
        created_at timestamptz not null default now()
      )
    `);

    await client.query(`
      create index if not exists idx_security_rate_limit_events_action_key_created_at
      on security_rate_limit_events (action, key, created_at desc)
    `);
  });

  ensuredSecurityTables = true;
}

export async function consumeRateLimit(options: RateLimitOptions) {
  const { action, key, limit, windowSeconds } = options;
  await ensureSecurityTables();

  return withPgTransaction(async (client) => {
    const countRow = await client.query<{ count: string }>(
      `
        select count(*)::text as count
        from security_rate_limit_events
        where action = $1
          and key = $2
          and created_at >= now() - ($3::text || ' seconds')::interval
      `,
      [action, key, String(windowSeconds)]
    );

    const count = Number(countRow.rows[0]?.count ?? 0);
    if (count >= limit) {
      return {
        allowed: false,
        retryAfterSeconds: windowSeconds,
      };
    }

    await client.query(
      `
        insert into security_rate_limit_events (action, key)
        values ($1, $2)
      `,
      [action, key]
    );

    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  });
}

export function getRequestIp(request: Request) {
  const forwarded = normalizeForwardedValue(request.headers.get("x-forwarded-for"));
  if (forwarded) return forwarded;

  const realIp = normalizeForwardedValue(request.headers.get("x-real-ip"));
  if (realIp) return realIp;

  return "unknown";
}

export async function getServerActionIp() {
  const requestHeaders = await headers();
  return (
    normalizeForwardedValue(requestHeaders.get("x-forwarded-for")) ||
    normalizeForwardedValue(requestHeaders.get("x-real-ip")) ||
    "unknown"
  );
}

export function sanitizeTextInput(
  value: unknown,
  options?: {
    maxLength?: number;
    multiline?: boolean;
  }
) {
  const maxLength = options?.maxLength ?? 1000;
  const multiline = Boolean(options?.multiline);

  let text = String(value ?? "");
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  text = multiline ? text.replace(/\r\n/g, "\n") : text.replace(/\s+/g, " ");
  text = text.trim();

  if (text.length > maxLength) {
    text = text.slice(0, maxLength).trim();
  }

  return text;
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function assertSameOriginRequest(request: Request) {
  const origin = normalizeOrigin(request.headers.get("origin") ?? "");
  const expected = getExpectedRequestOrigin(request);

  if (!origin) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing request origin");
    }
    return;
  }

  if (!expected || origin !== expected) {
    throw new Error("Invalid request origin");
  }
}

export async function assertSameOriginServerAction() {
  const requestHeaders = await headers();
  const origin = normalizeOrigin(requestHeaders.get("origin") ?? "");
  const expected = normalizeOrigin(
    getExpectedOriginFromHost(
      requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
      requestHeaders.get("x-forwarded-proto")
    )
  );

  if (!origin) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing request origin");
    }
    return;
  }

  if (!expected || origin !== expected) {
    throw new Error("Invalid request origin");
  }
}

export async function assertSameOriginServerActionIfPresent() {
  const requestHeaders = await headers();
  const origin = normalizeOrigin(requestHeaders.get("origin") ?? "");
  if (!origin) return;

  const expected = normalizeOrigin(
    getExpectedOriginFromHost(
      requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
      requestHeaders.get("x-forwarded-proto")
    )
  );

  if (!expected || origin !== expected) {
    throw new Error("Invalid request origin");
  }
}

export async function hasAnyRows(tableName: string) {
  const row = await pgOne<{ exists: boolean }>(
    `select exists(select 1 from ${tableName} limit 1) as exists`
  );
  return Boolean(row.exists);
}
