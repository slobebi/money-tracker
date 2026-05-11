-- Run this in your Supabase SQL Editor
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT DO NOTHING / DROP POLICY IF EXISTS

-- ─── Cards ─────────────────────────────────────────────────────────────────────
create table if not exists cards (
  id              text    primary key,
  name            text    not null,
  type            text    not null check (type in ('credit','debit')),
  color           text    not null default '#6c63ff',
  bill_day        int,
  due_day         int,
  due_next_month  boolean not null default false,
  credit_limit    numeric not null default 0,
  current_balance numeric not null default 0,
  monthly_salary  numeric not null default 0,
  active          boolean not null default true,
  sort_order      int     not null default 0,
  updated_at      timestamptz default now()
);
alter table cards enable row level security;
drop policy if exists "Allow all" on cards;
create policy "Allow all" on cards for all using (true) with check (true);

insert into cards (id, name, type, color, bill_day, due_day, due_next_month, sort_order) values
  ('card1', 'Tokopedia BRI',  'credit', '#9b94ff', 16, 31, false, 1),
  ('card2', 'Atome Mayapada', 'credit', '#f5a623', 15, 4,  true,  2),
  ('card3', 'BCA',            'credit', '#3ecf8e', 3,  19, false, 3),
  ('cash',  'BCA Debit',      'debit',  '#6b7080', null, null, false, 4)
on conflict (id) do nothing;

-- ─── Transactions ──────────────────────────────────────────────────────────────
create table if not exists transactions (
  id          bigint generated always as identity primary key,
  created_at  timestamptz default now(),
  date        date        not null,
  amount      numeric     not null check (amount > 0),
  type        text        not null check (type in ('expense', 'income')),
  method      text        not null,
  category    text        not null,
  note        text,
  split_id    uuid
);
alter table transactions enable row level security;
drop policy if exists "Allow all" on transactions;
create policy "Allow all" on transactions for all using (true) with check (true);
create index if not exists transactions_date_idx on transactions (date);

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

-- ─── Card Payments ─────────────────────────────────────────────────────────────
create table if not exists card_payments (
  id         bigint generated always as identity primary key,
  created_at timestamptz default now(),
  date       date        not null,
  card_id    text        not null,
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
  method       text    not null,
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

-- ─── Installments ──────────────────────────────────────────────────────────────
create table if not exists installments (
  id               bigint generated always as identity primary key,
  created_at       timestamptz default now(),
  description      text    not null,
  card_id          text    not null,
  monthly_amount   numeric not null check (monthly_amount > 0),
  total_months     int     not null check (total_months > 0),
  paid_months      int     not null default 0 check (paid_months >= 0),
  start_year_month text    not null,
  category         text    not null,
  note             text
);
alter table installments enable row level security;
drop policy if exists "Allow all" on installments;
create policy "Allow all" on installments for all using (true) with check (true);
