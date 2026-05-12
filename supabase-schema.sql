-- GardenDex Supabase Schema
-- Run this in your Supabase project: Dashboard → SQL Editor → New Query

-- ── Plants ──────────────────────────────────────────────────────────────────

create table if not exists plants (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz default now()
);

-- Each user can only see/edit their own plants
alter table plants enable row level security;
create policy "Users can manage own plants"
  on plants for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Credits ─────────────────────────────────────────────────────────────────

create table if not exists credits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 10,
  lifetime_used integer not null default 0,
  updated_at timestamptz default now()
);

alter table credits enable row level security;
create policy "Users can view own credits"
  on credits for select
  using (auth.uid() = user_id);
-- Writes only allowed via service role (API routes) — no direct client writes

-- ── Payments ────────────────────────────────────────────────────────────────

create table if not exists payments (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  stripe_payment_id text unique,
  pack_id text,
  credits_purchased integer,
  amount_cents integer,
  created_at timestamptz default now()
);

alter table payments enable row level security;
create policy "Users can view own payments"
  on payments for select
  using (auth.uid() = user_id);

-- ── Stored Procedure: add_credits ───────────────────────────────────────────
-- Called by stripe-webhook.js after successful payment
-- Upserts credits row and logs payment atomically

create or replace function add_credits(
  p_user_id uuid,
  p_credits integer,
  p_payment_id text,
  p_amount_cents integer
)
returns void
language plpgsql
security definer
as $$
begin
  -- Upsert credits (insert if first time, add to existing balance)
  insert into credits (user_id, balance, lifetime_used, updated_at)
    values (p_user_id, p_credits, 0, now())
  on conflict (user_id)
  do update set
    balance = credits.balance + p_credits,
    updated_at = now();

  -- Log payment
  insert into payments (id, user_id, stripe_payment_id, credits_purchased, amount_cents)
    values (gen_random_uuid()::text, p_user_id, p_payment_id, p_credits, p_amount_cents)
  on conflict (stripe_payment_id) do nothing;
end;
$$;



-- ── Trigger: create credits row on signup ───────────────────────────────────
-- Automatically gives new users 10 free scans

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into credits (user_id, balance, lifetime_used)
  values (new.id, 10, 0)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();


-- ── Pro Tier ─────────────────────────────────────────────────────────────────

-- Add is_pro column to credits table
alter table credits add column if not exists is_pro boolean not null default false;
alter table credits add column if not exists pro_purchased_at timestamptz;
alter table credits add column if not exists daily_scan_count integer not null default 0;
alter table credits add column if not exists daily_scan_reset_at date default current_date;

-- ── Stored Procedure: upgrade_to_pro ─────────────────────────────────────────
-- Called by stripe-webhook.js when Pro payment succeeds

create or replace function upgrade_to_pro(
  p_user_id uuid,
  p_payment_id text,
  p_amount_cents integer
)
returns void
language plpgsql
security definer
as $$
begin
  -- Upsert credits row, mark as Pro with unlimited balance
  insert into credits (user_id, balance, lifetime_used, is_pro, pro_purchased_at, updated_at)
    values (p_user_id, 99999, 0, true, now(), now())
  on conflict (user_id)
  do update set
    balance = 99999,
    is_pro = true,
    pro_purchased_at = now(),
    updated_at = now();

  -- Log payment
  insert into payments (id, user_id, stripe_payment_id, pack_id, credits_purchased, amount_cents)
    values (gen_random_uuid()::text, p_user_id, p_payment_id, 'pro_lifetime', 99999, p_amount_cents)
  on conflict (stripe_payment_id) do nothing;
end;
$$;

-- ── Updated spend_credit: enforces daily limit for Pro users ──────────────────

create or replace function spend_credit(p_user_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  rec credits%rowtype;
begin
  select * into rec
  from credits
  where user_id = p_user_id
  for update;

  if not found then
    return false;
  end if;

  -- Reset daily count if it's a new day
  if rec.daily_scan_reset_at < current_date then
    update credits
    set daily_scan_count = 0, daily_scan_reset_at = current_date
    where user_id = p_user_id;
    rec.daily_scan_count := 0;
  end if;

  -- Pro users: check daily limit (50/day abuse prevention), don't touch balance
  if rec.is_pro then
    if rec.daily_scan_count >= 50 then
      return false;  -- daily limit hit
    end if;
    update credits
    set
      daily_scan_count = daily_scan_count + 1,
      lifetime_used = lifetime_used + 1,
      updated_at = now()
    where user_id = p_user_id;
    return true;
  end if;

  -- Free/credit users: check balance
  if rec.balance <= 0 then
    return false;
  end if;

  update credits
  set
    balance = balance - 1,
    daily_scan_count = daily_scan_count + 1,
    lifetime_used = lifetime_used + 1,
    updated_at = now()
  where user_id = p_user_id;

  return true;
end;
$$;
