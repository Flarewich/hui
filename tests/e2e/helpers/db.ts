import crypto from "crypto";
import { hashSync } from "bcryptjs";
import { Client } from "pg";
import { expect, type BrowserContext } from "@playwright/test";

function uuid() {
  return crypto.randomUUID();
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function getClient() {
  return new Client({
    host: process.env.PGHOST || "127.0.0.1",
    port: Number(process.env.PGPORT || 5435),
    database: process.env.PGDATABASE || "appdb",
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "postgres",
  });
}

export type SeedUser = {
  id: string;
  email: string;
  password: string;
  username: string;
  role: "user" | "admin" | "sponsor";
};

export type SeedTournament = {
  id: string;
  title: string;
  mode: "solo" | "duo" | "squad";
};

export async function withDb<T>(fn: (client: Client) => Promise<T>) {
  const client = getClient();
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export async function createUser(params: Partial<SeedUser> & { role?: SeedUser["role"] }) {
  const user: SeedUser = {
    id: params.id ?? uuid(),
    email: params.email ?? `user_${Date.now()}_${Math.floor(Math.random() * 10_000)}@local.test`,
    password: params.password ?? "User123!",
    username: params.username ?? `user_${Math.floor(Math.random() * 10_000)}`,
    role: params.role ?? "user",
  };

  await withDb(async (client) => {
    await client.query(
      `
        insert into profiles (id, username, role)
        values ($1, $2, $3)
      `,
      [user.id, user.username, user.role]
    );

    await client.query(
      `
        insert into user_accounts (user_id, email, password_hash, updated_at)
        values ($1, $2, $3, now())
      `,
      [user.id, user.email.toLowerCase(), hashSync(user.password, 10)]
    );
  });

  return user;
}

export async function deleteUser(userId: string) {
  await withDb(async (client) => {
    await client.query(`delete from app_sessions where user_id = $1`, [userId]);
    await client.query(`delete from user_accounts where user_id = $1`, [userId]);
    await client.query(`delete from profiles where id = $1`, [userId]);
  });
}

export async function createTournament(params?: Partial<SeedTournament>) {
  const tournament: SeedTournament = {
    id: params?.id ?? uuid(),
    title: params?.title ?? `E2E Tournament ${Date.now()}`,
    mode: params?.mode ?? "duo",
  };

  await withDb(async (client) => {
    await client.query(
      `
        insert into tournaments (id, title, status, mode, start_at, prize_pool, max_teams)
        values ($1, $2, 'upcoming', $3, $4, 100, 8)
      `,
      [tournament.id, tournament.title, tournament.mode, new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()]
    );
  });

  return tournament;
}

export async function deleteTournament(tournamentId: string) {
  await withDb(async (client) => {
    await client.query(`delete from registrations where tournament_id = $1`, [tournamentId]);
    await client.query(`delete from prize_claims where tournament_id = $1`, [tournamentId]);
    await client.query(`delete from tournament_results where tournament_id = $1`, [tournamentId]);
    await client.query(`delete from tournament_schedule where tournament_id = $1`, [tournamentId]);
    await client.query(`delete from tournaments where id = $1`, [tournamentId]);
  });
}

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  await withDb(async (client) => {
    await client.query(
      `
        insert into app_sessions (id, user_id, token_hash, expires_at)
        values ($1, $2, $3, $4)
      `,
      [uuid(), userId, sha256(token), new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()]
    );
  });
  return token;
}

export async function attachSession(context: BrowserContext, token: string) {
  await context.addCookies([
    {
      name: "app_session",
      value: token,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
    {
      name: "lang",
      value: "en",
      domain: "127.0.0.1",
      path: "/",
      sameSite: "Lax",
    },
  ]);
}

export async function createPrizeClaim(params: {
  tournamentId: string;
  winnerUserId: string;
  amount?: number;
}) {
  const id = uuid();
  await withDb(async (client) => {
    await client.query(
      `
        insert into prize_claims (id, tournament_id, place, winner_user_id, amount, status, created_at, updated_at)
        values ($1, $2, 1, $3, $4, 'awaiting_details', now(), now())
      `,
      [id, params.tournamentId, params.winnerUserId, params.amount ?? 100]
    );
  });
  return id;
}

export async function createSupportThread(userId: string) {
  const id = uuid();
  await withDb(async (client) => {
    await client.query(
      `
        insert into support_threads (id, user_id, status, updated_at)
        values ($1, $2, 'open', now())
      `,
      [id, userId]
    );
  });
  return id;
}

export async function createSupportMessage(params: {
  userId: string;
  senderId: string;
  body: string;
}) {
  const threadId = await createSupportThread(params.userId);
  await withDb(async (client) => {
    const ticket = await client.query<{ id: string }>(
      `
        insert into support_tickets (user_id, status)
        values ($1, 'open')
        returning id
      `,
      [params.userId]
    ).catch(async () => {
      return client.query<{ id: string }>(
        `select id from support_tickets where user_id = $1 order by updated_at desc limit 1`,
        [params.userId]
      );
    });

    await client.query(
      `
        insert into support_messages (id, thread_id, ticket_id, sender_id, body, message)
        values ($1, $2, $3, $4, $5, $5)
      `,
      [uuid(), threadId, ticket.rows[0]?.id ?? null, params.senderId, params.body]
    );
  });
  return threadId;
}

export async function createTeamRegistration(params: {
  captainUserId: string;
  tournamentId: string;
  teamName: string;
  mode?: "duo" | "squad";
}) {
  const teamId = uuid();
  await withDb(async (client) => {
    await client.query(
      `
        insert into teams (id, name, mode, captain_id, join_type)
        values ($1, $2, $3, $4, 'open')
      `,
      [teamId, params.teamName, params.mode ?? "duo", params.captainUserId]
    );

    await client.query(
      `
        insert into team_members (team_id, user_id)
        values ($1, $2)
      `,
      [teamId, params.captainUserId]
    );

    await client.query(
      `
        insert into registrations (tournament_id, user_id, team_id)
        values ($1, $2, $3)
      `,
      [params.tournamentId, params.captainUserId, teamId]
    );
  });
  return teamId;
}

export async function cleanupSupportForUser(userId: string) {
  await withDb(async (client) => {
    await client.query(`delete from support_threads where user_id = $1`, [userId]);
  });
}

export async function getLatestResetToken(email: string) {
  return withDb(async (client) => {
    const row = await client.query<{ text_body: string }>(
      `
        select text_body
        from email_outbox
        where lower(to_email) = lower($1) and kind = 'password_reset'
        order by created_at desc
        limit 1
      `,
      [email]
    );
    const body = row.rows[0]?.text_body ?? "";
    const match = body.match(/token=([a-f0-9]+)/i);
    return match?.[1] ?? null;
  });
}

export async function expectLoggedIn(pageUrl: string, pageText: string, page: import("@playwright/test").Page) {
  await page.goto(pageUrl);
  await expect(page.getByText(pageText)).toBeVisible();
}
