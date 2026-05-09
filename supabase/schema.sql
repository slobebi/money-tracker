-- Run this in your Supabase SQL Editor
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT DO NOTHING / DROP POLICY IF EXISTS

-- ─── Transactions ──────────────────────────────────────────────────────────────
create table if not exists transactions (
  id          bigint generated always as identity primary key,
  created_at  timestamptz default now(),
  date        date        not null,
  amount      numeric     not null check (amount > 0),
  type        text        not null check (type in ('expense', 'income')),
  method      text        not null check (method in ('card1', 'card2', 'card3', 'cash')),
  category    text        not null,
  note        text,
  split_id    uuid
);
alter table transactions enable row level security;
drop policy if exists "Allow all" on transactions;
create policy "Allow all" on transactions for all using (true) with check (true);
create index if not exists transactions_date_idx on transactions (date);
alter table transactions add column if not exists split_id uuid;

-- ─── Card Limits ───────────────────────────────────────────────────────────────
create table if not exists card_limits (
  card_id         text    primary key check (card_id in ('card1', 'card2', 'card3')),
  total_limit     numeric not null default 0,
  current_balance numeric not null default 0,
  updated_at      timestamptz default now()
);
alter table card_limits enable row level security;
drop policy if exists "Allow all" on card_limits;
create policy "Allow all" on card_limits for all using (true) with check (true);

-- ─── Categories ────────────────────────────────────────────────────────────────
create table if not exists categories (
  id         bigint generated always as identity primary key,
  name       text not null unique,
  created_at timestamptz default now()
);
alter table categories enable row level security;
drop policy if exists "Allow all" on categories;
create policy "Allow all" on categories for all using (true) with check (true);

insert into categories (name) values
  ('Food & Dining'), ('Groceries'), ('Transport'), ('Shopping'),
  ('Entertainment'), ('Health'), ('Bills & Utilities'), ('Travel'),
  ('Education'), ('Other')
on conflict (name) do nothing;

-- ─── BCA Debit Settings ────────────────────────────────────────────────────────
create table if not exists debit_settings (
  id              int primary key default 1 check (id = 1),
  initial_balance numeric not null default 0,
  monthly_salary  numeric not null default 0,
  updated_at      timestamptz default now()
);
alter table debit_settings enable row level security;
drop policy if exists "Allow all" on debit_settings;
create policy "Allow all" on debit_settings for all using (true) with check (true);
alter table debit_settings add column if not exists monthly_salary numeric not null default 0;

-- ─── Card Payments ─────────────────────────────────────────────────────────────
create table if not exists card_payments (
  id         bigint generated always as identity primary key,
  created_at timestamptz default now(),
  date       date        not null,
  card_id    text        not null check (card_id in ('card1', 'card2', 'card3')),
  amount     numeric     not null check (amount > 0),
  note       text
);
alter table card_payments enable row level security;
drop policy if exists "Allow all" on card_payments;
create policy "Allow all" on card_payments for all using (true) with check (true);
create index if not exists card_payments_date_idx on card_payments (date);

-- ─── Budgets ───────────────────────────────────────────────────────────────────
create table if not exists budgets (
  category       text    primary key,
  monthly_amount numeric not null default 0,
  updated_at     timestamptz default now()
);
alter table budgets enable row level security;
drop policy if exists "Allow all" on budgets;
create policy "Allow all" on budgets for all using (true) with check (true);

-- ─── Recurring Transactions ────────────────────────────────────────────────────
create table if not exists recurring_transactions (
  id           bigint generated always as identity primary key,
  created_at   timestamptz default now(),
  name         text    not null,
  amount       numeric not null check (amount > 0),
  type         text    not null check (type in ('expense', 'income')),
  method       text    not null check (method in ('card1', 'card2', 'card3', 'cash')),
  category     text    not null,
  note         text,
  day_of_month int     not null check (day_of_month between 1 and 28),
  active       boolean not null default true
);
alter table recurring_transactions enable row level security;
drop policy if exists "Allow all" on recurring_transactions;
create policy "Allow all" on recurring_transactions for all using (true) with check (true);

-- ─── Recurring Confirmations ───────────────────────────────────────────────────
create table if not exists recurring_confirmations (
  id             bigint generated always as identity primary key,
  recurring_id   bigint not null references recurring_transactions(id) on delete cascade,
  month          text   not null,
  transaction_id bigint references transactions(id) on delete set null,
  confirmed_at   timestamptz default now(),
  unique(recurring_id, month)
);
alter table recurring_confirmations enable row level security;
drop policy if exists "Allow all" on recurring_confirmations;
create policy "Allow all" on recurring_confirmations for all using (true) with check (true);
