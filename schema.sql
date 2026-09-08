-- Waterline — database setup
-- Paste this whole file into Supabase: SQL Editor > New query > Run

create table if not exists plans (
  user_id    uuid primary key references auth.users on delete cascade,
  data       jsonb not null,
  updated_at timestamptz default now()
);

-- Row-level security: the database itself refuses cross-user reads,
-- so a bug in the front end cannot leak one person's data to another.
alter table plans enable row level security;

drop policy if exists "own rows only" on plans;
create policy "own rows only" on plans
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
