import { pgMaybeOne, pgQuery } from "@/lib/postgres";

function buildSponsorName(userId: string, username?: string | null) {
  const trimmed = (username ?? "").trim();
  if (trimmed) return trimmed.slice(0, 64);
  return `Sponsor ${userId.slice(0, 8)}`;
}

export async function ensureSponsorRecordForProfile(params: {
  userId: string;
  username?: string | null;
}) {
  const { userId, username } = params;
  const fallbackName = buildSponsorName(userId, username);

  // Try to find an existing sponsor row by exact name first to avoid duplicates.
  const existingByName = await pgMaybeOne<{ id: string; is_active: boolean | null }>(
    `
      select id, is_active
      from sponsors
      where name = $1
      limit 1
    `,
    [fallbackName]
  );

  if (existingByName?.id) {
    if (!existingByName.is_active) {
      await pgQuery(
        `
          update sponsors
          set is_active = true
          where id = $1
        `,
        [existingByName.id]
      );
    }
    return;
  }

  await pgQuery(
    `
      insert into sponsors (name, tier, href, logo_url, is_active)
      values ($1, 'partner', null, null, true)
    `,
    [fallbackName]
  );
}
