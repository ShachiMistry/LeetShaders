-- LeetShaders Initial Schema
-- Created on May 4, 2026

-- 1. Challenges Table
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text not null,
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  reference_shader_src text not null,
  tolerance float not null,
  use_blur boolean not null default false,
  hint_text text,
  credit text,
  created_at timestamptz default now()
);

-- 2. Solves Table
create table if not exists public.solves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  challenge_id uuid references public.challenges(id) not null,
  final_score float not null,
  mae_score float not null,
  llm_score float,
  submitted_shader_src text not null,
  passed boolean not null,
  solved_at timestamptz default now()
);

-- 3. Judge Cache Table
create table if not exists public.judge_cache (
  cache_key text primary key,  -- sha256(challenge_id || shader_src)
  llm_score float not null,
  llm_reasoning text,
  flagged boolean not null,
  cached_at timestamptz default now()
);

-- 4. API Telemetry Table
create table if not exists public.api_telemetry (
  id uuid primary key default gen_random_uuid(),
  model text not null,
  input_tokens int not null,
  output_tokens int not null,
  latency_ms int not null,
  cache_hit boolean not null,
  call_type text not null,  -- 'judge' | 'hint'
  called_at timestamptz default now()
);

-- Row Level Security (RLS) Policies

-- Challenges: Read access for everyone (public)
alter table public.challenges enable row level security;
create policy "Challenges are viewable by everyone" on public.challenges for select using (true);

-- Solves: Users can read their own solves; only the authenticated user can insert their own.
alter table public.solves enable row level security;
create policy "Users can view their own solves" on public.solves for select using (auth.uid() = user_id);
create policy "Users can insert their own solves" on public.solves for insert with check (auth.uid() = user_id);

-- Judge Cache: Authenticated users can read and write
alter table public.judge_cache enable row level security;
create policy "Authenticated users can view judge cache" on public.judge_cache for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert into judge cache" on public.judge_cache for insert with check (auth.role() = 'authenticated');

-- API Telemetry: Only authenticated users can insert
alter table public.api_telemetry enable row level security;
create policy "Authenticated users can insert telemetry" on public.api_telemetry for insert with check (auth.role() = 'authenticated');
