import { expect, test } from "@playwright/test";
import { attachSession, createSession, createTeamRegistration, createTournament, createUser, deleteTournament, deleteUser, withDb } from "./helpers/db";

test("open team tournament flow works end-to-end", async ({ browser }) => {
  const captain = await createUser({ username: `capt_${Date.now()}` });
  const joiner = await createUser({ username: `join_${Date.now()}` });
  const tournament = await createTournament({ mode: "duo" });

  const captainToken = await createSession(captain.id);
  const joinerToken = await createSession(joiner.id);

  const captainContext = await browser.newContext({ baseURL: "http://127.0.0.1:3000" });
  const joinerContext = await browser.newContext({ baseURL: "http://127.0.0.1:3000" });

  const teamName = `E2E Team ${Date.now()}`;

  try {
    await attachSession(captainContext, captainToken);
    await attachSession(joinerContext, joinerToken);

    await createTeamRegistration({
      captainUserId: captain.id,
      tournamentId: tournament.id,
      teamName,
      mode: "duo",
    });

    const joinerPage = await joinerContext.newPage();
    await joinerPage.goto("/profile");
    await expect(joinerPage.getByText(teamName)).toBeVisible();
    const openTeamCard = joinerPage.locator("div.rounded-2xl.border.border-white\\/10.bg-black\\/20.p-4").filter({
      has: joinerPage.getByText(teamName),
    });
    await openTeamCard.getByRole("button", { name: "Join" }).click();

    await expect
      .poll(async () => {
        return withDb(async (client) => {
          const row = await client.query<{ count: string }>(
            `select count(*)::text as count from registrations where tournament_id = $1 and user_id = $2`,
            [tournament.id, joiner.id]
          );
          return Number(row.rows[0]?.count ?? 0);
        });
      })
      .toBe(1);

    await joinerPage.goto(`/tournaments/${tournament.id}`);
    await expect(joinerPage.getByRole("button", { name: "Cancel registration" })).toBeVisible();
    await joinerPage.getByRole("button", { name: "Cancel registration" }).click();

    await expect
      .poll(async () => {
        return withDb(async (client) => {
          const reg = await client.query<{ count: string }>(
            `select count(*)::text as count from registrations where tournament_id = $1 and user_id = $2`,
            [tournament.id, joiner.id]
          );
          const membership = await client.query<{ count: string }>(
            `select count(*)::text as count from team_members where user_id = $1`,
            [joiner.id]
          );
          return `${reg.rows[0]?.count ?? "0"}:${membership.rows[0]?.count ?? "0"}`;
        });
      })
      .toBe("0:0");
  } finally {
    await captainContext.close();
    await joinerContext.close();
    await deleteTournament(tournament.id);
    await deleteUser(captain.id);
    await deleteUser(joiner.id);
  }
});
