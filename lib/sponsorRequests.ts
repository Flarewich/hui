import { pgMaybeOne, pgQuery, pgRows } from "@/lib/postgres";

export type SponsorRequestRow = {
  id: string;
  user_id: string;
  username: string | null;
  full_name: string;
  brand_name: string | null;
  contact_email: string;
  contact_details: string;
  offer_summary: string;
  status: string;
  created_at: string;
  updated_at: string;
};

let ensuredSponsorRequestsTable = false;

export async function ensureSponsorRequestsTable() {
  if (ensuredSponsorRequestsTable) return;

  await pgQuery(`
    create table if not exists sponsor_requests (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references profiles(id) on delete cascade,
      full_name text not null,
      brand_name text null,
      contact_email text not null,
      contact_details text not null,
      offer_summary text not null,
      status text not null default 'pending_review',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await pgQuery(`
    create index if not exists idx_sponsor_requests_status_created_at
    on sponsor_requests(status, created_at desc)
  `);

  await pgQuery(`
    create index if not exists idx_sponsor_requests_user_id
    on sponsor_requests(user_id)
  `);

  await pgQuery(`
    do $$
    begin
      if not exists (
        select 1
        from information_schema.table_constraints
        where table_schema = 'public'
          and table_name = 'sponsor_requests'
          and constraint_name = 'sponsor_requests_status_check'
      ) then
        alter table sponsor_requests
          add constraint sponsor_requests_status_check
          check (status in ('pending_review', 'reviewed', 'approved', 'rejected'));
      end if;
    end $$;
  `);

  ensuredSponsorRequestsTable = true;
}

export async function createSponsorRequest(params: {
  userId: string;
  fullName: string;
  brandName?: string | null;
  contactEmail: string;
  contactDetails: string;
  offerSummary: string;
}) {
  await ensureSponsorRequestsTable();

  const existing = await pgMaybeOne<{ id: string }>(
    `
      select id
      from sponsor_requests
      where user_id = $1
        and status in ('pending_review', 'reviewed')
      order by created_at desc
      limit 1
    `,
    [params.userId]
  );

  if (existing?.id) {
    await pgQuery(
      `
        update sponsor_requests
        set
          full_name = $2,
          brand_name = $3,
          contact_email = $4,
          contact_details = $5,
          offer_summary = $6,
          status = 'pending_review',
          updated_at = now()
        where id = $1
      `,
      [
        existing.id,
        params.fullName,
        params.brandName ?? null,
        params.contactEmail,
        params.contactDetails,
        params.offerSummary,
      ]
    );
    return existing.id;
  }

  const created = await pgMaybeOne<{ id: string }>(
    `
      insert into sponsor_requests (
        user_id,
        full_name,
        brand_name,
        contact_email,
        contact_details,
        offer_summary
      )
      values ($1, $2, $3, $4, $5, $6)
      returning id
    `,
    [
      params.userId,
      params.fullName,
      params.brandName ?? null,
      params.contactEmail,
      params.contactDetails,
      params.offerSummary,
    ]
  );

  return created?.id ?? null;
}

export async function listSponsorRequests() {
  await ensureSponsorRequestsTable();

  return pgRows<SponsorRequestRow>(
    `
      select
        sr.id,
        sr.user_id,
        p.username,
        sr.full_name,
        sr.brand_name,
        sr.contact_email,
        sr.contact_details,
        sr.offer_summary,
        sr.status,
        sr.created_at,
        sr.updated_at
      from sponsor_requests sr
      join profiles p on p.id = sr.user_id
      order by
        case sr.status
          when 'pending_review' then 0
          when 'reviewed' then 1
          when 'approved' then 2
          else 3
        end,
        sr.created_at desc
    `
  );
}

export async function updateSponsorRequestStatus(id: string, status: string) {
  await ensureSponsorRequestsTable();
  if (!["pending_review", "reviewed", "approved", "rejected"].includes(status)) return;

  await pgQuery(
    `
      update sponsor_requests
      set status = $2, updated_at = now()
      where id = $1
    `,
    [id, status]
  );
}
