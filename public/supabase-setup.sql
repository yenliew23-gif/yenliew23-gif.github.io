-- Gym Tracker — full Supabase setup (idempotent, safe to re-run)
-- Run this in Supabase Dashboard → SQL Editor → New query → Run

-- Tables
create table if not exists exercises (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  muscle_group text not null,
  notes text,
  created_at bigint not null,
  archived boolean default false
);

create table if not exists workouts (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  created_at bigint not null,
  name text,
  bodyweight numeric,
  exercises jsonb not null,
  note text
);

create table if not exists workout_templates (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  created_at bigint not null,
  updated_at bigint not null,
  exercises jsonb not null,
  archived boolean default false
);

-- Indexes
create index if not exists exercises_user_id_idx on exercises(user_id);
create index if not exists workouts_user_id_idx on workouts(user_id);
create index if not exists workouts_date_idx on workouts(user_id, date desc);
create index if not exists workout_templates_user_id_idx on workout_templates(user_id);

-- RLS
alter table exercises enable row level security;
alter table workouts enable row level security;
alter table workout_templates enable row level security;

-- Drop ALL existing policies first (handles re-runs cleanly)
do $$
declare r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('exercises', 'workouts', 'workout_templates')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Recreate policies
create policy "Users see only their own exercises"
  on exercises for select using (auth.uid() = user_id);
create policy "Users insert their own exercises"
  on exercises for insert with check (auth.uid() = user_id);
create policy "Users update their own exercises"
  on exercises for update using (auth.uid() = user_id);
create policy "Users delete their own exercises"
  on exercises for delete using (auth.uid() = user_id);

create policy "Users see only their own workouts"
  on workouts for select using (auth.uid() = user_id);
create policy "Users insert their own workouts"
  on workouts for insert with check (auth.uid() = user_id);
create policy "Users update their own workouts"
  on workouts for update using (auth.uid() = user_id);
create policy "Users delete their own workouts"
  on workouts for delete using (auth.uid() = user_id);

create policy "Users see only their own templates"
  on workout_templates for select using (auth.uid() = user_id);
create policy "Users insert their own templates"
  on workout_templates for insert with check (auth.uid() = user_id);
create policy "Users update their own templates"
  on workout_templates for update using (auth.uid() = user_id);
create policy "Users delete their own templates"
  on workout_templates for delete using (auth.uid() = user_id);
