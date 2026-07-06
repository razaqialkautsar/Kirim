-- ===========================================================================
-- Migration 002: Tambah kolom tx_type dan exchange_rate ke tabel transactions
-- Jalankan file ini di SQL Editor Supabase Dashboard SETELAH 001 berhasil
-- (Database → SQL Editor → New Query → paste → Run)
-- ===========================================================================

-- Kolom tx_type membedakan jenis transaksi:
--   'disbursement' = kirim uang split ke beberapa penerima (default, kompatibel data lama)
--   'onramp'       = simulasi setor MYR → TESTUSD
--   'offramp'      = simulasi cairkan TESTUSD → IDR (akan dipakai di Tahap 4B)
alter table public.transactions
  add column if not exists tx_type text not null default 'disbursement';

-- Kolom exchange_rate menyimpan kurs yang dipakai saat on-ramp/off-ramp
-- Contoh: 0.22 berarti 1 MYR = 0.22 TESTUSD
alter table public.transactions
  add column if not exists exchange_rate numeric(12, 6);

-- Indeks untuk filter transaksi berdasarkan tipe (berguna di dashboard nanti)
create index if not exists transactions_tx_type_idx on public.transactions(tx_type);

comment on column public.transactions.tx_type is 'Tipe transaksi: disbursement | onramp | offramp';
comment on column public.transactions.exchange_rate is 'Kurs konversi yang dipakai (misal MYR→USD atau USD→IDR)';
