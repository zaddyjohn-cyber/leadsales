-- Run this in your Supabase SQL editor

create table if not exists subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users(id) on delete cascade,
  plan                text not null,          -- 'starter' | 'pro' | 'agency'
  leads_total         integer not null,
  leads_remaining     integer not null,
  active              boolean default true,
  paystack_reference  text,
  created_at          timestamptz default now()
);

create table if not exists extraction_logs (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users(id) on delete cascade,
  subscription_id     uuid references subscriptions(id),
  category            text,
  country             text,
  state               text,
  quantity_requested  integer,
  leads_returned      integer,
  created_at          timestamptz default now()
);

-- Row level security: users can only read their own data
alter table subscriptions    enable row level security;
alter table extraction_logs  enable row level security;

create policy "users_own_subscriptions"
  on subscriptions for select
  using (auth.uid() = user_id);

create policy "users_own_logs"
  on extraction_logs for select
  using (auth.uid() = user_id);
