import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

/*
══════════════════════════════════════════════════════
  RUN THIS SQL IN YOUR SUPABASE SQL EDITOR
  Dashboard → SQL Editor → New Query → paste → Run
  RLS is enabled automatically inside each table block.
══════════════════════════════════════════════════════

-- TABLE 1: row_history
create table if not exists row_history (
  id          bigserial    primary key,
  row_name    char(1)      not null,
  number      int          not null check (number >= 0 and number <= 99),
  source      text         not null default 'manual',
  created_at  timestamptz  not null default now()
);
alter table row_history enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'row_history' and policyname = 'anon_all'
  ) then
    execute 'create policy anon_all on row_history for all to anon using (true) with check (true)';
  end if;
end $$;

-- TABLE 2: algo_weights
create table if not exists algo_weights (
  algo_name    text   primary key,
  weight       float  not null default 1.0,
  correct_count int   not null default 0,
  total_count   int   not null default 0,
  updated_at   timestamptz not null default now()
);
alter table algo_weights enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'algo_weights' and policyname = 'anon_all'
  ) then
    execute 'create policy anon_all on algo_weights for all to anon using (true) with check (true)';
  end if;
end $$;

-- TABLE 3: api_config
create table if not exists api_config (
  row_name    char(1)     primary key,
  api_url     text        not null default '',
  enabled     boolean     not null default false,
  updated_at  timestamptz not null default now()
);
alter table api_config enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'api_config' and policyname = 'anon_all'
  ) then
    execute 'create policy anon_all on api_config for all to anon using (true) with check (true)';
  end if;
end $$;

══════════════════════════════════════════════════════
  The do $$ ... $$ blocks are idempotent — safe to
  run multiple times without duplicate policy errors.
══════════════════════════════════════════════════════
*/
