import { randomBytes, randomUUID, createHash } from "crypto";
import { cookies } from "next/headers";
import { compare as bcryptCompare, hash as bcryptHash } from "bcryptjs";
import { pgMaybeOne, pgOne, pgQuery } from "@/lib/postgres";

export const SESSION_COOKIE_NAME = "app_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type SessionProfile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  role: string | null;
  is_banned: boolean | null;
  banned_until: string | null;
  restricted_until: string | null;
  is_blocked?: boolean;
};

export type AuthUser = {
  id: string;
  email: string | null;
  app_metadata: { role?: string | null };
};

type AccountRow = {
  user_id: string;
  email: string;
  password_hash: string | null;
};

type LegacyAuthRow = {
  id: string;
  email: string | null;
  encrypted_password: string | null;
  raw_app_meta_data: unknown;
};

let ensuredAuthTables = false;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeRole(role: unknown) {
  return role === "admin" || role === "sponsor" ? role : "user";
}

function usernameFromEmail(email?: string | null) {
  if (!email) return "player";
  const [name] = email.split("@");
  return (name || "player").slice(0, 24);
}

export async function ensureAuthTables() {
  if (ensuredAuthTables) return;

  await pgQuery(`
    create table if not exists user_accounts (
      user_id uuid primary key references profiles(id) on delete cascade,
      email text not null unique,
      password_hash text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await pgQuery(`
    create table if not exists app_sessions (
      id uuid primary key,
      user_id uuid not null references profiles(id) on delete cascade,
      token_hash text not null unique,
      expires_at timestamptz not null,
      created_at timestamptz not null default now(),
      last_seen_at timestamptz not null default now()
    )
  `);

  ensuredAuthTables = true;
}

async function hasLegacyAuthUsersTable() {
  const row = await pgOne<{ exists: boolean }>(
    `select to_regclass('auth.users') is not null as exists`
  );
  return Boolean(row.exists);
}

async function getLegacyAuthUserByEmail(email: string) {
  if (!(await hasLegacyAuthUsersTable())) return null;
  return pgMaybeOne<LegacyAuthRow>(
    `
      select id, email, encrypted_password, raw_app_meta_data
      from auth.users
      where lower(email) = lower($1)
      limit 1
    `,
    [email]
  );
}

export async function ensureProfileForAccount(params: {
  userId: string;
  email?: string | null;
  usernameInput?: string | null;
  role?: unknown;
}) {
  const { userId, email, usernameInput, role } = params;
  const safeRole = normalizeRole(role);
  const username = (usernameInput?.trim() || usernameFromEmail(email)).slice(0, 24);

  const existing = await pgMaybeOne<{ id: string; role: string | null }>(
    `
      select id, role
      from profiles
      where id = $1
      limit 1
    `,
    [userId]
  );

  if (existing?.id) {
    if (existing.role !== "admin" && safeRole === "admin") {
      await pgQuery(`update profiles set role = 'admin' where id = $1`, [userId]);
    }
    return;
  }

  await pgQuery(
    `
      insert into profiles (id, username, role)
      values ($1, $2, $3)
    `,
    [userId, username, safeRole]
  );
}

async function upsertLocalAccount(account: { userId: string; email: string; passwordHash: string | null }) {
  await pgQuery(
    `
      insert into user_accounts (user_id, email, password_hash, updated_at)
      values ($1, lower($2), $3, now())
      on conflict (user_id) do update
      set email = excluded.email,
          password_hash = coalesce(excluded.password_hash, user_accounts.password_hash),
          updated_at = now()
    `,
    [account.userId, account.email, account.passwordHash]
  );
}

export async function findLocalAccountByEmail(email: string) {
  await ensureAuthTables();
  return pgMaybeOne<AccountRow>(
    `
      select user_id, email, password_hash
      from user_accounts
      where lower(email) = lower($1)
      limit 1
    `,
    [email]
  );
}

export async function registerWithPassword(params: {
  email: string;
  password: string;
  usernameInput?: string | null;
}) {
  await ensureAuthTables();

  const email = params.email.trim().toLowerCase();
  const existingLocal = await findLocalAccountByEmail(email);
  const legacy = await getLegacyAuthUserByEmail(email);
  if (existingLocal || legacy) {
    throw new Error("Account already exists");
  }

  const userId = randomUUID();
  const passwordHash = await bcryptHash(params.password, 10);

  await ensureProfileForAccount({
    userId,
    email,
    usernameInput: params.usernameInput,
    role: "user",
  });
  await upsertLocalAccount({ userId, email, passwordHash });
  return { userId, email };
}

export async function authenticateWithPassword(emailRaw: string, password: string) {
  await ensureAuthTables();
  const email = emailRaw.trim().toLowerCase();

  const local = await findLocalAccountByEmail(email);
  if (local?.password_hash && (await bcryptCompare(password, local.password_hash))) {
    return { userId: local.user_id, email: local.email };
  }

  const legacy = await getLegacyAuthUserByEmail(email);
  if (legacy?.id && legacy.email && legacy.encrypted_password && (await bcryptCompare(password, legacy.encrypted_password))) {
    const metadataRole =
      legacy.raw_app_meta_data && typeof legacy.raw_app_meta_data === "object"
        ? (legacy.raw_app_meta_data as { role?: unknown }).role
        : null;
    await ensureProfileForAccount({
      userId: legacy.id,
      email: legacy.email,
      role: metadataRole,
    });
    await upsertLocalAccount({
      userId: legacy.id,
      email: legacy.email,
      passwordHash: legacy.encrypted_password,
    });
    return { userId: legacy.id, email: legacy.email };
  }

  return null;
}

export async function createSessionForUser(userId: string) {
  await ensureAuthTables();
  const token = randomBytes(32).toString("hex");
  const tokenHash = sha256(token);
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await pgQuery(
    `
      insert into app_sessions (id, user_id, token_hash, expires_at)
      values ($1, $2, $3, $4)
    `,
    [sessionId, userId, tokenHash, expiresAt.toISOString()]
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await ensureAuthTables();
    await pgQuery(`delete from app_sessions where token_hash = $1`, [sha256(token)]);
  }
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}

export async function getSessionByToken(token: string | null | undefined) {
  if (!token) return null;
  await ensureAuthTables();
  const row = await pgMaybeOne<{
    user_id: string;
    email: string | null;
    role: string | null;
    username: string | null;
    avatar_url: string | null;
    is_banned: boolean | null;
    banned_until: string | null;
    restricted_until: string | null;
    is_blocked: boolean;
    expires_at: string;
  }>(
    `
      select
        s.user_id,
        a.email,
        p.role,
        p.username,
        p.avatar_url,
        p.is_banned,
        p.banned_until,
        p.restricted_until,
        (
          coalesce(p.is_banned, false)
          or (p.banned_until is not null and p.banned_until > now())
          or (p.restricted_until is not null and p.restricted_until > now())
        ) as is_blocked,
        s.expires_at
      from app_sessions s
      left join user_accounts a on a.user_id = s.user_id
      join profiles p on p.id = s.user_id
      where s.token_hash = $1
      limit 1
    `,
    [sha256(token)]
  );

  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await pgQuery(`delete from app_sessions where token_hash = $1`, [sha256(token)]);
    return null;
  }

  await pgQuery(`update app_sessions set last_seen_at = now() where token_hash = $1`, [sha256(token)]);

  const user: AuthUser = {
    id: row.user_id,
    email: row.email,
    app_metadata: { role: row.role ?? null },
  };
  const profile: SessionProfile = {
    id: row.user_id,
    username: row.username,
    avatar_url: row.avatar_url,
    role: row.role,
    is_banned: row.is_banned,
    banned_until: row.banned_until,
    restricted_until: row.restricted_until,
    is_blocked: row.is_blocked,
  };

  return { user, profile };
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  return getSessionByToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

export async function getProfileByUserId(userId: string) {
  return pgMaybeOne<SessionProfile>(
    `
      select
        id,
        username,
        avatar_url,
        role,
        is_banned,
        banned_until,
        restricted_until,
        (
          coalesce(is_banned, false)
          or (banned_until is not null and banned_until > now())
          or (restricted_until is not null and restricted_until > now())
        ) as is_blocked
      from profiles
      where id = $1
      limit 1
    `,
    [userId]
  );
}
