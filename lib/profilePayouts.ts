import { pgQuery } from "@/lib/postgres";

let ensuredProfilePayoutColumns = false;

export async function ensureProfilePayoutColumns() {
  if (ensuredProfilePayoutColumns) return;

  await pgQuery(`
    alter table profiles
      add column if not exists payout_iban text
  `);

  ensuredProfilePayoutColumns = true;
}
