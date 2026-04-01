import { withDb } from "./helpers/db";

export default async function globalSetup() {
  await withDb(async (client) => {
    await client.query(`
      delete from security_rate_limit_events
      where action in (
        'login:ip',
        'login:ip-email',
        'signup:ip',
        'password-reset:request:ip',
        'password-reset:complete:ip',
        'support:admin-message:ip',
        'support:admin-message:user',
        'support:user-message:ip',
        'support:user-message:user',
        'support:admin-status:user',
        'sponsor-request:ip',
        'sponsor-request:email',
        'profile:update:ip-user'
      )
    `);
  });
}
