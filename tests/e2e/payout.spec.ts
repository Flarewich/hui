import { expect, test } from "@playwright/test";
import { attachSession, createPrizeClaim, createSession, createTournament, createUser, deleteTournament, deleteUser, withDb } from "./helpers/db";

test("payout flow works for user and admin", async ({ browser }) => {
  const winner = await createUser({ username: `winner_${Date.now()}` });
  const admin = await createUser({ username: `pay_admin_${Date.now()}`, role: "admin" });
  const tournament = await createTournament({ mode: "solo" });
  await createPrizeClaim({ tournamentId: tournament.id, winnerUserId: winner.id, amount: 150 });

  const winnerToken = await createSession(winner.id);
  const adminToken = await createSession(admin.id);
  const winnerContext = await browser.newContext({ baseURL: "http://127.0.0.1:3000" });
  const adminContext = await browser.newContext({ baseURL: "http://127.0.0.1:3000" });

  try {
    await attachSession(winnerContext, winnerToken);
    await attachSession(adminContext, adminToken);

    const winnerPage = await winnerContext.newPage();
    await winnerPage.goto("/profile");
    await winnerPage.getByText("Send payment details", { exact: true }).click();
    await winnerPage.locator('select[name=\"payout_method\"]').selectOption("manual");
    await winnerPage.locator('input[name=\"recipient_name\"]').fill("Winner Test");
    await winnerPage.locator('textarea[name=\"payment_details\"]').fill("IBAN DE89370400440532013000");
    await winnerPage.getByRole("button", { name: "Submit" }).click();
    await expect(winnerPage.getByText("Payment details sent. Waiting for admin review.")).toBeVisible();

    await expect
      .poll(async () => {
        return withDb(async (client) => {
          const row = await client.query<{ status: string }>(
            `select status from prize_claims where winner_user_id = $1 and tournament_id = $2 limit 1`,
            [winner.id, tournament.id]
          );
          return row.rows[0]?.status ?? "";
        });
      })
      .toBe("pending_review");

    const adminPage = await adminContext.newPage();
    await adminPage.goto("/admin/payments");
    await adminPage.getByRole("button", { name: "approve" }).first().click();
    await adminPage.getByRole("button", { name: "paid" }).first().click();

    await expect
      .poll(async () => {
        return withDb(async (client) => {
          const row = await client.query<{ status: string }>(
            `select status from prize_claims where winner_user_id = $1 and tournament_id = $2 limit 1`,
            [winner.id, tournament.id]
          );
          return row.rows[0]?.status ?? "";
        });
      })
      .toBe("paid");

    await winnerPage.reload();
    await expect(winnerPage.getByText(/Prize paid/).last()).toBeVisible();
  } finally {
    await winnerContext.close();
    await adminContext.close();
    await deleteTournament(tournament.id);
    await deleteUser(winner.id);
    await deleteUser(admin.id);
  }
});
