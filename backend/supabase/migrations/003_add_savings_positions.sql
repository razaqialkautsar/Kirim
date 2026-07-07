-- ============================================================
-- Migrasi 003: Tabel savings_positions (Simulasi Blend Yield)
-- ============================================================
-- Tabel ini menyimpan posisi tabungan user.
-- Backend akan menghitung bunga (yield) secara dinamis
-- berdasarkan selisih waktu antara deposited_at dan waktu sekarang.

create table savings_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  amount_deposited numeric not null default 0,
  deposited_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Setiap user hanya boleh punya 1 posisi tabungan aktif
create unique index idx_savings_user_unique on savings_positions(user_id);

-- Row Level Security
alter table savings_positions enable row level security;

create policy "Service role full access on savings_positions"
  on savings_positions
  for all
  using (true)
  with check (true);
