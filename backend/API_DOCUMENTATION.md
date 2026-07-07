# Dokumentasi API Backend - Kirim Remittance

Dokumen ini berisi panduan lengkap untuk mengetes seluruh *endpoint* Backend menggunakan **Postman**.

---

## 🔑 Langkah 0: Mendapatkan Token JWT (Prasyarat Utama)

Hampir seluruh API kita dilindungi oleh autentikasi. Kamu wajib *login* untuk mendapatkan token JWT dari Supabase terlebih dahulu.

- **Method:** `POST`
- **URL:** `https://hkydzspclkplebvwljtn.supabase.co/auth/v1/token?grant_type=password`
- **Headers:**
  - `apikey`: `<Masukkan SUPABASE_ANON_KEY>`
  - `Content-Type`: `application/json`
- **Body (JSON):**
  ```json
  {
    "email": "admin@test.com",
    "password": "passwordrahasia123"
  }
  ```
> **Catatan:** *Copy* isi `"access_token"` dari hasil balasan, lalu gunakan sebagai header `Authorization: Bearer <token>` untuk semua API di bawah ini.

---

## 🟢 1. Cek Status Server (Health)
Mengecek apakah server Node.js menyala.
- **Method:** `GET`
- **URL:** `http://localhost:3001/health`
- **Headers:** *(Tidak perlu)*

---

## 🟢 2. Buat Dompet Stellar (Provision Wallet)
Membuatkan dompet Stellar untuk *user* yang baru mendaftar, mengisinya dengan modal awal XLM (dari Friendbot), dan mendaftarkan *Trustline* untuk koin TESTUSD.
- **Method:** `POST`
- **URL:** `http://localhost:3001/api/wallets/provision`
- **Headers:**
  - `Authorization`: `Bearer <token_jwt>`

---

## 🟢 3. On-Ramp (Setor Ringgit Malaysia)
Simulasi PMI menyetorkan uang MYR di loket/agen Malaysia, yang akan langsung dikonversi menjadi koin digital `TESTUSD` dan masuk ke dompet Stellar miliknya.
- **Method:** `POST`
- **URL:** `http://localhost:3001/api/onramp/simulate`
- **Headers:**
  - `Authorization`: `Bearer <token_jwt>`
  - `Content-Type`: `application/json`
- **Body (JSON):**
  ```json
  {
    "amountMYR": 500
  }
  ```

---

## 🟢 4. Kirim Uang ke Banyak Penerima (Split Disbursement)
Fitur inti pengiriman uang. Mengirim TESTUSD dari dompet *sender* (PMI) ke maksimal 5 dompet penerima (keluarga) sekaligus dalam persentase tertentu, dieksekusi secara instan dan atomik.
- **Method:** `POST`
- **URL:** `http://localhost:3001/api/transactions/send`
- **Headers:**
  - `Authorization`: `Bearer <token_jwt>`
  - `Content-Type`: `application/json`
- **Body (JSON):**
  ```json
  {
    "totalAmount": 100,
    "recipients": [
      {
        "receiverId": "uuid-penerima-1",
        "percentageBps": 6000
      },
      {
        "receiverId": "uuid-penerima-2",
        "percentageBps": 4000
      }
    ]
  }
  ```
> *Catatan: `percentageBps` adalah basis point (10000 = 100%). Total keseluruhannya harus persis 10000.*

---

## 🟢 5. Cek File Konfigurasi Stellar (SEP-24)
Mengambil file metadata `stellar.toml` agar aplikasi *wallet* dari luar bisa menemukan layanan pencairan uang (Anchor) milik kita.
- **Method:** `GET`
- **URL:** `http://localhost:3001/.well-known/stellar.toml`
- **Headers:** *(Tidak perlu)*

---

## 🟢 6. Minta Akses Pencairan (Withdraw Interactive)
Standar protokol Stellar SEP-24 saat pengguna menekan tombol "Tarik Dana". Akan mengembalikan URL formulir rahasia.
- **Method:** `POST`
- **URL:** `http://localhost:3001/sep24/transactions/withdraw/interactive`
- **Headers:**
  - `Authorization`: `Bearer <token_jwt>`

---

## 🟢 7. Off-Ramp (Pencairan ke Rekening Bank Lokal)
Simulasi keluarga di Indonesia menukarkan `TESTUSD` mereka menjadi Rupiah (IDR) lalu ditransfer langsung ke rekening Bank Lokal (BCA/Mandiri/dll).
- **Method:** `POST`
- **URL:** `http://localhost:3001/api/offramp/submit-bank`
- **Headers:**
  - `Authorization`: `Bearer <token_jwt>`
  - `Content-Type`: `application/json`
- **Body (JSON):**
  ```json
  {
    "transactionId": "sep24-99999",
    "bankCode": "BCA",
    "accountNumber": "1234567890",
    "accountName": "Budi Santoso",
    "amountTESTUSD": 50
  }
  ```

---

## 🟢 8. Dashboard (Halaman Beranda & Riwayat)
Satu *endpoint* ajaib yang langsung mengembalikan detail dompet, riwayat transaksi lengkap, dan angka **Kalkulator Penghematan Uang** dibanding biaya bank tradisional.
- **Method:** `GET`
- **URL:** `http://localhost:3001/api/dashboard`
- **Headers:**
  - `Authorization`: `Bearer <token_jwt>`

---

## 🟢 9. Tabungan Blend (Simulasi Yield P1)
Fitur *Composability* untuk menabung XLM dan mendapatkan simulasi bunga (yield) *real-time*.

### 9.1. Deposit XLM ke Tabungan
- **Method:** `POST`
- **URL:** `http://localhost:3001/api/savings/deposit`
- **Headers:**
  - `Authorization`: `Bearer <token_jwt>`
  - `Content-Type`: `application/json`
- **Body (JSON):**
  ```json
  {
    "amount": 100
  }
  ```

### 9.2. Cek Saldo & Simulasi Bunga (Yield)
Endpoint ini akan mengembalikan jumlah saldo XLM yang ditabung ditambah dengan bunga harian (berbasis APY statis) yang akan bertambah setiap detiknya.
- **Method:** `GET`
- **URL:** `http://localhost:3001/api/savings`
- **Headers:**
  - `Authorization`: `Bearer <token_jwt>`

### 9.3. Tarik Tabungan (Withdraw)
- **Method:** `POST`
- **URL:** `http://localhost:3001/api/savings/withdraw`
- **Headers:**
  - `Authorization`: `Bearer <token_jwt>`
  - `Content-Type`: `application/json`
- **Body (JSON):**
  ```json
  {
    "amount": 50
  }
  ```
