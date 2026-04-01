import { expect, test } from "@playwright/test";
import { deleteUser, getLatestResetToken, withDb } from "./helpers/db";

test("user can sign up and sign in", async ({ page }) => {
  const email = `signup_${Date.now()}@local.test`;
  const password = "User123!";
  const username = `signup_${Date.now()}`;

  await withDb(async (client) => {
    await client.query(`
      delete from security_rate_limit_events
      where action in (
        'auth:signin:ip',
        'auth:signin:ip-email',
        'auth:signup:ip'
      )
    `);
  });

  await page.context().addCookies([
    { name: "lang", value: "en", domain: "127.0.0.1", path: "/" },
  ]);

  try {
    await page.goto("/login?tab=signup");
    await page.getByPlaceholder("Nickname (optional)").fill(username);
    await page.getByPlaceholder("you@mail.com").fill(email);
    await page.getByPlaceholder("Password (min 6 chars)").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/login\?tab=signin/);
    await expect(page.getByText("Registration successful. Now sign in.")).toBeVisible();

    await page.getByPlaceholder("you@mail.com").fill(email);
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/$/);
  } finally {
    const userId = await withDb(async (client) => {
      const row = await client.query<{ user_id: string }>(
        `select user_id from user_accounts where lower(email) = lower($1) limit 1`,
        [email]
      );
      return row.rows[0]?.user_id ?? null;
    });
    if (userId) {
      await deleteUser(userId);
    }
  }
});

test("user can reset password from email outbox", async ({ page }) => {
  const email = `reset_${Date.now()}@local.test`;
  const oldPassword = "User123!";
  const newPassword = "User123!new";

  await page.context().addCookies([
    { name: "lang", value: "en", domain: "127.0.0.1", path: "/" },
  ]);

  let userId: string | null = null;
  try {
    await page.goto("/login?tab=signup");
    await page.getByPlaceholder("you@mail.com").fill(email);
    await page.getByPlaceholder("Password (min 6 chars)").fill(oldPassword);
    await page.getByRole("button", { name: "Create account" }).click();

    await page.goto("/reset-password");
    await page.getByPlaceholder("you@mail.com").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText("If the account exists, reset instructions were sent to email.")).toBeVisible();

    await expect.poll(async () => getLatestResetToken(email)).not.toBeNull();
    const token = await getLatestResetToken(email);
    if (!token) {
      throw new Error("Reset token was not queued");
    }

    await page.goto(`/reset-password?token=${token}`);
    await page.getByPlaceholder("New password (min 6 chars)").fill(newPassword);
    await page.getByRole("button", { name: "Save new password" }).click();

    await expect(page).toHaveURL(/\/login\?tab=signin/);
    await page.getByPlaceholder("you@mail.com").fill(email);
    await page.getByPlaceholder("Password").fill(newPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/$/);
  } finally {
    userId = await withDb(async (client) => {
      const row = await client.query<{ user_id: string }>(
        `select user_id from user_accounts where lower(email) = lower($1) limit 1`,
        [email]
      );
      return row.rows[0]?.user_id ?? null;
    });
    if (userId) {
      await deleteUser(userId);
    }
  }
});
