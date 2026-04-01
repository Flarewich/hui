import { createHash, randomBytes, randomUUID } from "crypto";
import { hash as bcryptHash } from "bcryptjs";
import { pgMaybeOne, pgQuery, withPgTransaction } from "@/lib/postgres";
import { ensureAuthTables, findLocalAccountByEmail } from "@/lib/sessionAuth";
import { getAppBaseUrl, queueEmail } from "@/lib/email";

let ensuredPasswordResetTables = false;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function ensurePasswordResetTables() {
  if (ensuredPasswordResetTables) return;

  await ensureAuthTables();
  await pgQuery(`
    create table if not exists password_reset_tokens (
      id uuid primary key,
      user_id uuid not null references profiles(id) on delete cascade,
      token_hash text not null unique,
      expires_at timestamptz not null,
      used_at timestamptz,
      created_at timestamptz not null default now()
    )
  `);

  await pgQuery(`
    create index if not exists idx_password_reset_tokens_user_id_created_at
    on password_reset_tokens (user_id, created_at desc)
  `);

  ensuredPasswordResetTables = true;
}

export async function createPasswordReset(emailRaw: string, locale: "ru" | "en") {
  await ensurePasswordResetTables();
  const email = emailRaw.trim().toLowerCase();
  const account = await findLocalAccountByEmail(email);
  if (!account?.user_id) {
    return { ok: true, queued: false };
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await withPgTransaction(async (client) => {
    await client.query(
      `
        update password_reset_tokens
        set used_at = now()
        where user_id = $1 and used_at is null
      `,
      [account.user_id]
    );

    await client.query(
      `
        insert into password_reset_tokens (id, user_id, token_hash, expires_at)
        values ($1, $2, $3, $4)
      `,
      [randomUUID(), account.user_id, tokenHash, expiresAt]
    );
  });

  const resetUrl = `${getAppBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const subject = locale === "en" ? "Reset your password" : "Сброс пароля";
  const textBody =
    locale === "en"
      ? `Open this link to reset your password:\n\n${resetUrl}\n\nThe link is valid for 1 hour.`
      : `Откройте ссылку, чтобы сбросить пароль:\n\n${resetUrl}\n\nСсылка действует 1 час.`;

  await queueEmail({
    toEmail: email,
    subject,
    textBody,
    kind: "password_reset",
    userId: account.user_id,
    meta: { resetUrl },
  });

  return { ok: true, queued: true };
}

export async function getValidPasswordResetToken(rawToken: string) {
  await ensurePasswordResetTables();
  const tokenHash = sha256(rawToken);
  return pgMaybeOne<{ user_id: string }>(
    `
      select user_id
      from password_reset_tokens
      where token_hash = $1
        and used_at is null
        and expires_at > now()
      limit 1
    `,
    [tokenHash]
  );
}

export async function resetPasswordWithToken(rawToken: string, newPassword: string) {
  await ensurePasswordResetTables();
  const tokenHash = sha256(rawToken);
  const passwordHash = await bcryptHash(newPassword, 10);

  return withPgTransaction(async (client) => {
    const token = await client.query<{ user_id: string }>(
      `
        select user_id
        from password_reset_tokens
        where token_hash = $1
          and used_at is null
          and expires_at > now()
        limit 1
      `,
      [tokenHash]
    );

    const userId = token.rows[0]?.user_id;
    if (!userId) {
      return { ok: false as const };
    }

    await client.query(
      `
        update user_accounts
        set password_hash = $2, updated_at = now()
        where user_id = $1
      `,
      [userId, passwordHash]
    );

    await client.query(
      `
        update password_reset_tokens
        set used_at = now()
        where token_hash = $1
      `,
      [tokenHash]
    );

    await client.query(`delete from app_sessions where user_id = $1`, [userId]);

    return { ok: true as const, userId };
  });
}
