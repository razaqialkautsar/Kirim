# Backend Implementation Spec — Proyek "Kirim"
Dokumen ini adalah konteks kerja untuk AI coding agent yang mengerjakan bagian **backend/Web2**
proyek Kirim (APAC Stellar Hackathon 2026). Baca bersamaan dengan `PRD_Kirim_Stellar_Remittance.md`
dan `SMART_CONTRACT_SPEC.md` untuk konteks produk & interface smart contract secara lengkap.

**Catatan penting untuk agent**: Stellar SDK dan Supabase SDK sama-sama berkembang cepat dengan
breaking changes antar versi. Sebelum menulis kode apapun yang memanggil `@stellar/stellar-sdk`
atau `@supabase/supabase-js`, cek dulu dokumentasi resmi terbaru:
- https://developers.stellar.org/docs
- https://supabase.com/docs

Jangan asumsikan signature fungsi dari memori training tanpa verifikasi.

---

## 0. Peran Backend dalam Arsitektur

Backend adalah jembatan antara: **Frontend (sender/receiver UI) ↔ Database ↔ Stellar Network ↔
Smart Contract Soroban**. Backend TIDAK menulis logic on-chain (itu tugas smart contract), tapi
bertanggung jawab memanggil logic itu, menyiapkan data yang dibutuhkan, dan menyimpan/menampilkan
hasilnya.

Asset yang dipakai: **TESTUSD (self-issued)** — lihat `stellar-remittance-setup/` untuk script
generate issuer, distributor, dan akun dummy testing. Alamat SAC (`C...`) dari asset ini adalah
yang dipakai sebagai parameter `asset: Address` di pemanggilan smart contract.

Database: **PostgreSQL via Supabase** (managed, dengan built-in Auth mendukung passkey/WebAuthn).

---

## 1. Identity & Wallet Management

- [ ] Setup project Supabase baru, catat `SUPABASE_URL` dan `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Konfigurasi Supabase Auth dengan passkey (WebAuthn) sebagai metode login utama — cek dokumentasi
      resmi Supabase Auth untuk implementasi terbaru (fitur ini tergolong baru, verifikasi API-nya)
- [ ] Buat tabel `stellar_wallets`:
  ```sql
  create table stellar_wallets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) not null unique,
    stellar_public_key text not null unique,
    encrypted_secret_key text not null,
    created_at timestamptz default now()
  );
  ```
- [ ] Buat fungsi `provisionStellarAccount(userId: string)`:
  1. Generate Stellar keypair baru (`Keypair.random()`)
  2. Fund akun via Friendbot (testnet) — `GET https://friendbot.stellar.org?addr={publicKey}`
  3. Enkripsi secret key di level aplikasi SEBELUM disimpan (pakai `libsodium` atau `crypto` Node.js
     dengan key enkripsi dari environment variable, JANGAN simpan key enkripsi di tabel yang sama)
  4. Insert row ke `stellar_wallets`
  5. Panggil fungsi ini otomatis setiap kali user baru selesai register
- [ ] **JANGAN PERNAH** kirim `encrypted_secret_key` atau secret key mentah ke frontend/response API
      dalam bentuk apapun

---

## 2. Asset Setup (Referensi, Sudah Sebagian Dikerjakan)

Ini sudah dikerjakan lewat script terpisah di folder `stellar-remittance-setup/` — backend tinggal
pakai hasilnya, tidak perlu mengulang dari nol:

- [x] Issuer account TESTUSD sudah dibuat & di-fund (`setup-issuer-testusd.ts`)
- [x] Distributor account sudah punya trustline + saldo TESTUSD dari issuer
- [x] Akun dummy sender/receiver untuk testing sudah tersedia (`create-test-accounts.ts`)
- [ ] Deploy Stellar Asset Contract (SAC) untuk TESTUSD via Stellar CLI (`scripts/deploy-sac.sh`) —
      **catat alamat `C...` hasil deploy, ini WAJIB di-share ke tim smart contract**
- [ ] Simpan `TESTUSD_ISSUER_PUBLIC_KEY`, `TESTUSD_DISTRIBUTOR_SECRET_KEY`, dan alamat SAC (`C...`)
      sebagai environment variable di backend (bukan hardcoded di kode)

---

## 3. Transaction Orchestration (Split Disbursement)

Interface smart contract yang harus dipanggil (detail lengkap di `SMART_CONTRACT_SPEC.md`):
`create_disbursement(sender, total_amount, asset, recipients)` lalu `execute_disbursement(disbursement_id)`.
*(Catatan penting: Sangat disarankan berkoordinasi dengan tim SC agar 2 fungsi ini digabung menjadi 1 fungsi `create_and_execute` agar backend hanya butuh 1 kali pemanggilan).*

- [ ] Endpoint `POST /api/transactions/send`
  - Input: `{ senderId, recipients: [{ receiverId, percentageBps }], totalAmount }`
  - Validasi: total `percentageBps` harus tepat 10000, jumlah recipients **maksimal 5** (sesuai `SMART_CONTRACT_SPEC.md`)
  - Convert `senderId`/`receiverId` (internal UUID) → `stellar_public_key` dari tabel `stellar_wallets`
  - Decrypt secret key sender di memory sementara (jangan log/simpan hasil decrypt)
  - Build & sign transaction yang memanggil `create_disbursement` lalu `execute_disbursement`
  - Submit ke Soroban RPC testnet
  - Simpan record awal ke tabel `transactions` dengan status `pending`
- [ ] Endpoint `GET /api/transactions/:id/status`
  - Query status transaksi (polling ke smart contract via `get_disbursement`, atau baca dari
    tabel `transactions` yang sudah di-update event listener)
- [ ] Event listener/poller untuk event smart contract:
  - `DisbursementCreated` → update `transactions.status = 'created'`
  - `DisbursementCompleted` → update `transactions.status = 'completed'`, catat `completed_at`
  - `DisbursementFailed` → update `transactions.status = 'failed'`, catat `failure_reason`
- [ ] Buat tabel `transactions`:
  ```sql
  create table transactions (
    id uuid primary key default gen_random_uuid(),
    sender_id uuid references auth.users(id) not null,
    disbursement_id bigint,
    total_amount numeric not null,
    status text not null default 'pending',
    exchange_rate numeric,
    fee_amount numeric,
    failure_reason text,
    created_at timestamptz default now(),
    completed_at timestamptz
  );

  create table transaction_recipients (
    id uuid primary key default gen_random_uuid(),
    transaction_id uuid references transactions(id) not null,
    receiver_id uuid references auth.users(id),
    percentage_bps int not null,
    amount numeric not null
  );
  ```

---

## 4. Mock On-Ramp & Off-Ramp (SEP-24)

- [ ] Endpoint `POST /api/onramp/simulate`
  - Input: `{ userId, amountMYR }`
  - Simulasikan konversi MYR → TESTUSD dengan kurs statis/mock (dokumentasikan asumsi kursnya)
  - Kirim TESTUSD dari distributor ke wallet user (pakai payment operation biasa, bukan smart contract)
- [ ] Implementasi flow SEP-24 dasar untuk withdraw (off-ramp simulasi ke **IDR/Rupiah**):
  - `GET /.well-known/stellar.toml` — metadata anchor (wajib ada sesuai spec SEP-24)
  - `POST /sep24/transactions/withdraw/interactive` — mulai flow withdraw, kembalikan URL interaktif
  - `GET /sep24/transaction?id=...` — cek status transaksi withdraw
  - Cek dokumentasi resmi SEP-24 di https://developers.stellar.org untuk detail spec lengkap
    sebelum implementasi, karena ini format terstruktur yang harus persis sesuai standar
- [ ] Mock Bank API (internal, simulasi PJP/bank Indonesia):
  - `POST /api/mock-bank/transfer` — terima request transfer, balas sukses dengan delay realistis
    (misal 2-5 detik) untuk simulasi proses bank asli

---

## 5. Blend Integration (P1 — kerjakan setelah P0 selesai)

- [ ] Endpoint `POST /api/savings/deposit`
  - Input: `{ userId, amount }`
  - Panggil Blend testnet pool contract untuk deposit
  - Simpan record ke tabel `savings_positions`
- [ ] Endpoint `GET /api/savings/:userId`
  - Fetch posisi saldo + estimasi APY dari Blend
- [ ] Endpoint `POST /api/savings/withdraw`
  - Withdraw kapan saja tanpa penalty (sesuai PRD)
- [ ] Buat tabel `savings_positions`:
  ```sql
  create table savings_positions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) not null,
    amount_deposited numeric not null,
    current_value numeric,
    apy_snapshot numeric,
    deposited_at timestamptz default now(),
    withdrawn_at timestamptz
  );
  ```

---

## 6. Dashboard & History

- [ ] Endpoint `GET /api/dashboard/:userId`
  - Return gabungan: riwayat transaksi (pengirim melihat MYR, penerima melihat IDR), kurs konversi, biaya, dan
    akumulasi yield (jika ada posisi di `savings_positions`)
  - Sertakan perbandingan biaya vs rata-rata bank tradisional (4.80%, data dari PRD Appendix)
    untuk ditampilkan sebagai fitur diferensiasi di UI

---

## 7. Environment Variables yang Dibutuhkan

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
STELLAR_SECRET_ENCRYPTION_KEY=        # key buat enkripsi secret key user, BUKAN secret Stellar
TESTUSD_ISSUER_PUBLIC_KEY=
TESTUSD_DISTRIBUTOR_SECRET_KEY=
TESTUSD_SAC_ADDRESS=                  # alamat C..., diisi setelah deploy-sac.sh dijalankan
HORIZON_URL=https://horizon-testnet.stellar.org
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NETWORK_PASSPHRASE=Test SDF Network ; September 2015
```

---

## 8. Prioritas Pengerjaan (Selaras dengan PRD)

Urutan berikut mengikuti bobot kriteria penilaian di PRD — kerjakan sesuai urutan ini, jangan
loncat ke P1/P2 sebelum P0 jalan end-to-end:

1. **P0 dulu**: Identity & Wallet (bagian 1) → Transaction Orchestration (bagian 3) → SEP-24 mock
   dasar (bagian 4) → Dashboard minimal (bagian 6)
2. **P1 setelah P0 stabil**: Blend integration (bagian 5), kalkulator perbandingan biaya
3. **P2 kalau waktu sisa**: fitur nice-to-have sesuai PRD (notifikasi real-time, grafik yield historis)

---

## 9. Definition of Done per Task

Sebuah task dianggap selesai bukan hanya kalau kode sudah ditulis, tapi kalau:
- [ ] Endpoint bisa dites langsung (curl/Postman) dan mengembalikan response yang sesuai kontrak
- [ ] Perubahan state on-chain (kalau ada) bisa diverifikasi lewat Stellar testnet explorer
- [ ] Tidak ada secret key atau data sensitif yang ter-log ke console/error tracker
- [ ] Error case (input invalid, saldo kurang, network gagal) mengembalikan pesan yang jelas,
      bukan generic 500 error
