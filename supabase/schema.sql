-- UniScope correction reports for Supabase.
-- Run this once in the SQL editor of the project referenced by SUPABASE_URL.
-- The API uses the service-role key, which bypasses RLS; RLS is enabled so
-- the anon/public keys cannot read or write reports directly.

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'new'
    check (status in ('new', 'reviewing', 'resolved', 'rejected')),
  issue_type text not null
    check (issue_type in ('incorrect', 'outdated', 'missing', 'source-problem', 'other')),
  field text not null,
  details text not null,
  institution_id text,
  institution_name text,
  page_url text,
  source_url text,
  email text
);

create index if not exists reports_created_at_idx
  on public.reports (created_at desc);

alter table public.reports enable row level security;

-- No policies on purpose: only the service role (the API) may access rows.
