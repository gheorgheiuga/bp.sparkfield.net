-- Run once in the intended Supabase project's SQL editor, then enable the
-- before-user-created hook in Auth settings. No application data is modified.
create table if not exists public.horizon_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text
);
alter table public.horizon_access enable row level security;
revoke all on public.horizon_access from anon, authenticated;
-- The Vercel server uses the service role, and authorizes every operation itself.
-- A database auth hook also prevents direct Auth API signups from other domains.
create or replace function public.horizon_restrict_email(event jsonb)
returns jsonb language plpgsql stable set search_path = '' as $$
declare e text := lower(coalesce(event->'user'->>'email',''));
begin
  if e !~ '^[^@[:space:]]+@blueprojects[.]com$' then
    return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','A Blue Projects email address is required.'));
  end if;
  return '{}'::jsonb;
end $$;
revoke execute on function public.horizon_restrict_email(jsonb) from public, anon, authenticated;
grant execute on function public.horizon_restrict_email(jsonb) to supabase_auth_admin;
