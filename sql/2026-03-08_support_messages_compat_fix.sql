-- 2026-03-08: Compatibility fix for legacy support schema
-- Run this if support_messages.ticket_id NOT NULL blocks new chat flow.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'support_messages'
      and column_name = 'ticket_id'
  ) then
    alter table public.support_messages
      alter column ticket_id drop not null;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'support_messages'
      and column_name = 'message'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'support_messages'
      and column_name = 'body'
  ) then
    update public.support_messages
    set body = message
    where body is null and message is not null;
  end if;
end $$;
