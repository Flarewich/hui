import { expect, test } from "@playwright/test";
import { attachSession, cleanupSupportForUser, createSession, createSupportMessage, createUser, deleteUser, withDb } from "./helpers/db";

test("support chat works between user and admin", async ({ browser }) => {
  const user = await createUser({ username: `support_user_${Date.now()}` });
  const admin = await createUser({ username: `support_admin_${Date.now()}`, role: "admin" });
  const userToken = await createSession(user.id);
  const adminToken = await createSession(admin.id);

  const userContext = await browser.newContext({ baseURL: "http://127.0.0.1:3000" });
  const adminContext = await browser.newContext({ baseURL: "http://127.0.0.1:3000" });

  try {
    await attachSession(userContext, userToken);
    await attachSession(adminContext, adminToken);

    const userPage = await userContext.newPage();
    const adminPage = await adminContext.newPage();
    const userMessage = `Support message ${Date.now()}`;
    const adminReply = `Admin reply ${Date.now()}`;

    await createSupportMessage({
      userId: user.id,
      senderId: user.id,
      body: userMessage,
    });

    await userPage.goto("/support");
    await expect(userPage.getByText(userMessage)).toBeVisible();

    await adminPage.goto("/admin/support");
    await expect(adminPage.getByRole("button", { name: new RegExp(user.username) })).toBeVisible();
    await adminPage.reload();
    await expect(adminPage.getByText(userMessage)).toBeVisible();

    await adminPage.getByPlaceholder("Enter message").fill(adminReply);
    await adminPage.getByRole("button", { name: "Send" }).click();

    await expect
      .poll(async () => {
        return withDb(async (client) => {
          const row = await client.query<{ count: string }>(
            `
              select count(*)::text as count
              from support_messages sm
              join support_threads st on st.id = sm.thread_id
              where st.user_id = $1 and sm.body = $2
            `,
            [user.id, adminReply]
          );
          return Number(row.rows[0]?.count ?? 0);
        });
      })
      .toBe(1);

    await userPage.reload();
    await expect(userPage.getByText(adminReply)).toBeVisible();
  } finally {
    await userContext.close();
    await adminContext.close();
    await cleanupSupportForUser(user.id);
    await deleteUser(user.id);
    await deleteUser(admin.id);
  }
});
