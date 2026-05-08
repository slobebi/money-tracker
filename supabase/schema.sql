-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard)
-- Safe to re-run: all statements use IF NOT EXISTS / ON CONFLICT DO NOTHING

-- ─── Transactions ──────────────────────────────────────────────────────────────
create table if not exists transactions (
  id          bigint generated always as identity primary key,
  created_at  timestamptz default now(),
  date        date        not null,
  amount      numeric     not null check (amount > 0),
  type        text        not null check (type in ('expense', 'income')),
  method      text        not null check (method in ('card1', 'card2', 'card3', 'cash')),
  category    text        not null,
  note        text
);
alter table transactions enable row level security;
create policy "Allow all" on transactions for all using (true) with check (true);
create index if not exists transactions_date_idx on transactions (date);

-- ─── Card Limits ───────────────────────────────────────────────────────────────
create table if not exists card_limits (
  card_id         text    primary key check (card_id in ('card1', 'card2', 'card3')),
  total_limit     numeric not null default 0,
  current_balance numeric not null default 0,
  updated_at      timestamptz default now()
);
alter table card_limits enable row level security;
create policy "Allow all" on card_limits for all using (true) with check (true);

-- ─── Categories ────────────────────────────────────────────────────────────────
create table if not exists categories (
  id         bigint generated always as identity primary key,
  name       text not null unique,
  created_at timestamptz default now()
);
alter table categories enable row level security;
create policy "Allow all" on categories for all using (true) with check (true);

-- Seed default categories (safe to re-run)
insert into categories (name) values
  ('Food & Dining'),
  ('Groceries'),
  ('Transport'),
  ('Shopping'),
  ('Entertainment'),
  ('Health'),
  ('Bills & Utilities'),
  ('Travel'),
  ('Education'),
  ('Other')
on conflict (name) do nothing;

-- ─── BCA Debit Settings ────────────────────────────────────────────────────────
create table if not exists debit_settings (
  id              int primary key default 1 check (id = 1),  -- single row
  initial_balance numeric not null default 0,
  updated_at      timestamptz default now()
);
alter table debit_settings enable row level security;
create policy "Allow all" on debit_settings for all using (true) with check (true);

-- ─── Card Payments (credit card bills paid from BCA Debit) ─────────────────────
create table if not exists card_payments (
  id         bigint generated always as identity primary key,
  created_at timestamptz default now(),
  date       date        not null,
  card_id    text        not null check (card_id in ('card1', 'card2', 'card3')),
  amount     numeric     not null check (amount > 0),
  note       text
);
alter table card_payments enable row level security;
create policy "Allow all" on card_payments for all using (true) with check (true);
create index if not exists card_payments_date_idx on card_payments (date);
