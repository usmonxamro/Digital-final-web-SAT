-- v-nov01: card payments log (Payme). Run once in Supabase SQL Editor.
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  provider text not null,
  plan text not null,
  amount integer not null,
  status text not null check (status in ('paid', 'failed')),
  receipt_id text,
  created_at timestamptz not null default now()
);
create index if not exists payments_user_idx on payments(user_id, created_at desc);
alter table payments enable row level security;
