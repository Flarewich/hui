# Supabase Audit

## 1. Files where Supabase is or was used

### Dependencies and env

- `package.json`
- `package-lock.json`
- `lib/supabaseAdmin.ts`
- `lib/supabaseClient.ts`
- `lib/supabaseRoute.ts`
- `lib/supabaseServer.ts`
- `proxy.ts`
- `.env.local`
- `.env.example`

### Auth/session-bound app code

- `lib/auth.ts`
- `components/Header.tsx`
- `components/SupportChatWidgetGate.tsx`
- `app/(public)/login/page.tsx`
- `app/auth/callback/route.ts`
- `app/logout/route.ts`
- `app/(public)/tournaments/[id]/page.tsx`
- `app/(public)/tournaments/[id]/room/page.tsx`
- `app/(public)/tournaments/[id]/register/route.ts`
- `app/(public)/tournaments/[id]/unregister/route.ts`
- `app/(private)/teams/create/route.ts`
- `app/(private)/teams/join/route.ts`
- `app/(private)/teams/leave/route.ts`
- `app/(private)/teams/delete/route.ts`
- `app/(private)/profile/update/route.ts`
- `app/api/support/chat/route.ts`

### Storage / realtime / admin auth APIs

- `components/FloatingSupportChat.tsx`
- `app/admin/sponsors/page.tsx`
- `app/admin/users/page.tsx`

### Data-access files converted or partially converted

- `lib/pages.ts`
- `lib/registrationTable.ts`
- `lib/defaultGames.ts`
- `lib/sponsorSync.ts`
- `app/admin/page.tsx`
- `app/admin/payments/page.tsx`
- `app/api/teams/[id]/size/route.ts`
- `app/(public)/tournaments/[id]/room/page.tsx`
- `app/(public)/tournaments/[id]/register/route.ts`
- `app/(public)/tournaments/[id]/unregister/route.ts`
- `app/(private)/teams/create/route.ts`
- `app/(private)/teams/join/route.ts`
- `app/(private)/teams/leave/route.ts`
- `app/(private)/teams/delete/route.ts`

### SQL files with Supabase-specific policies / auth helpers

- `sql/2026-03-03_add_teams_and_team_registrations.sql`
- `sql/2026-03-03_add_tournament_schedule.sql`
- `sql/2026-03-08_add_support_chat.sql`

## 2. Automatically replaced with plain PostgreSQL (`pg`)

These places now use `lib/postgres.ts` instead of Supabase table access:

- `lib/pages.ts`
- `lib/registrationTable.ts`
- `lib/defaultGames.ts`
- `lib/sponsorSync.ts`
- `app/admin/page.tsx`
- `app/admin/payments/page.tsx`
- `app/api/teams/[id]/size/route.ts`
- `app/(public)/tournaments/[id]/room/page.tsx`
- `app/(public)/tournaments/[id]/register/route.ts`
- `app/(public)/tournaments/[id]/unregister/route.ts`
- `app/(private)/teams/create/route.ts`
- `app/(private)/teams/join/route.ts`
- `app/(private)/teams/leave/route.ts`
- `app/(private)/teams/delete/route.ts`

## 3. Remaining manual migration areas

### Auth

Still Supabase-bound:

- `lib/auth.ts`
- `lib/supabaseRoute.ts`
- `lib/supabaseServer.ts`
- `lib/supabaseClient.ts`
- `proxy.ts`
- `app/(public)/login/page.tsx`
- `app/auth/callback/route.ts`
- `app/logout/route.ts`
- any place that calls `supabase.auth.*`

Reason:

- session cookies and SSR session hydration depend on Supabase
- admin role sync currently depends on `supabaseAdmin.auth.admin.*`

Recommended replacement:

- own `users` table
- password hashing
- session/JWT layer
- middleware/session cookie handling

### Storage

Still Supabase-bound:

- `app/(private)/profile/update/route.ts`
- `app/admin/sponsors/page.tsx`

Reason:

- avatar and sponsor logo uploads use Supabase Storage APIs

Recommended replacement:

- local uploads for development
- S3-compatible object storage for production

### Realtime

Still Supabase-bound:

- `components/FloatingSupportChat.tsx`

Reason:

- support chat subscription uses Supabase realtime channels

Recommended replacement:

- polling
- WebSocket server
- third-party realtime broker

### Admin auth metadata sync

Still Supabase-bound:

- `app/admin/users/page.tsx`
- `app/admin/sponsors/page.tsx`

Reason:

- user role sync writes into Supabase Auth app metadata

Recommended replacement:

- keep roles only in your own `profiles` / `users` tables
- remove Supabase metadata dependency after custom auth migration

### Remaining table reads/writes not yet converted

- `app/(private)/profile/page.tsx`
- `app/(private)/support/page.tsx`
- `app/admin/support/page.tsx`
- `app/admin/tournaments/page.tsx`
- `app/api/support/chat/route.ts`

These are still feasible to migrate, but were not safe to finish automatically in the same pass because they are mixed with auth/session assumptions or larger feature flows.

## 4. Supabase-specific SQL objects

### RLS / policies

Found use of:

- `CREATE POLICY`
- `authenticated`
- `auth.uid()`

These are Supabase-style authorization helpers, not generic application authorization.

### Can be migrated

- regular tables
- regular indexes
- regular constraints
- regular triggers/functions that do not depend on `auth.uid()` or Supabase schemas

### Requires redesign

- policies using `auth.uid()`
- anything that expects Supabase JWT claims
- objects under `auth` or `storage` schemas from dumps
