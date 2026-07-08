# 📬 Kirim Backend — API Documentation & Postman Guide

> **Base URL:** `http://localhost:3001`
> **Versi Backend:** Branch `feat/blend-yield-integration`

---

## 🔐 Cara Mendapatkan JWT Token (Wajib Dilakukan Pertama Kali)

Semua endpoint bertanda 🔒 memerlukan **JWT Token** dari Supabase Auth di header:
```
Authorization: Bearer <token_jwt>
```

### Cara mendapatkan token via Supabase REST API:

**Method:** `POST`
**URL:** `https://hkydzspclkplebvwljtn.supabase.co/auth/v1/token?grant_type=password`

**Headers:**
```
Content-Type: application/json
apikey: <SUPABASE_ANON_KEY>
```

**Body (JSON):**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** Salin nilai `access_token` dari response JSON — itulah JWT Token kamu.

> **Tips Postman:** Buat **Environment Variable** bernama `jwt_token` dan isi nilainya, lalu di setiap request gunakan `Bearer {{jwt_token}}` di Authorization header. Tidak perlu copy-paste manual setiap kali.

---

## 📋 Daftar Semua Endpoint

| # | Method | Endpoint | Auth | Deskripsi |
|---|--------|----------|------|-----------|
| 1 | GET | `/health` | ❌ | Cek status server |
| 2 | POST | `/api/wallets/provision` | 🔒 | Buat/ambil wallet Stellar |
| 3 | GET | `/api/wallets/me` | 🔒 | Lihat alamat wallet |
| 4 | POST | `/api/onramp/simulate` | 🔒 | Simulasi top-up MYR → TESTUSD |
| 5 | POST | `/api/transactions/send` | 🔒 | Kirim TESTUSD ke banyak penerima |
| 6 | GET | `/api/transactions/:id` | 🔒 | Cek status transaksi |
| 7 | GET | `/.well-known/stellar.toml` | ❌ | Metadata Stellar Anchor |
| 8 | POST | `/sep24/transactions/withdraw/interactive` | 🔒 | Inisiasi proses off-ramp |
| 9 | POST | `/api/offramp/submit-bank` | 🔒 | Eksekusi pencairan ke rekening bank |
| 10 | GET | `/api/dashboard` | 🔒 | Data beranda + riwayat transaksi |
| 11 | POST | `/api/savings/deposit` | 🔒 | Deposit ke Blend (on-chain) |
| 12 | POST | `/api/savings/withdraw` | 🔒 | Tarik dari tabungan |
| 13 | GET | `/api/savings` | 🔒 | Cek saldo tabungan + yield |

---

## 1. Health Check

Untuk memastikan server backend berjalan.

- **Method:** `GET`
- **URL:** `http://localhost:3001/health`
- **Auth:** Tidak perlu

**Response Sukses:**
```json
{
  "status": "ok",
  "timestamp": "2026-07-08T10:00:00.000Z"
}
```

---

## 2. 🔒 Provisioning Wallet Stellar

Membuat akun Stellar baru untuk user yang sedang login. **Wajib dipanggil pertama kali sebelum bisa melakukan transaksi apapun.** Bersifat idempotent — aman dipanggil berkali-kali.

- **Method:** `POST`
- **URL:** `http://localhost:3001/api/wallets/provision`
- **Auth:** `Bearer {{jwt_token}}`
- **Body:** *(Tidak perlu body)*

**Response Sukses (201):**
```json
{
  "message": "Stellar wallet berhasil diprovisikan.",
  "stellar_public_key": "GABC123...XYZ"
}
```

---

## 3. 🔒 Lihat Wallet Saya

Mendapatkan public key Stellar milik user yang sedang login.

- **Method:** `GET`
- **URL:** `http://localhost:3001/api/wallets/me`
- **Auth:** `Bearer {{jwt_token}}`

**Response Sukses (200):**
```json
{
  "stellar_public_key": "GABC123...XYZ"
}
```

---

## 4. 🔒 Simulasi On-Ramp (Top-up MYR → TESTUSD)

Mensimulasikan proses penukaran Ringgit Malaysia (MYR) menjadi TESTUSD yang langsung dikirim ke dompet Stellar user. Kurs statis: **1 MYR = 0.22 TESTUSD**.

- **Method:** `POST`
- **URL:** `http://localhost:3001/api/onramp/simulate`
- **Auth:** `Bearer {{jwt_token}}`
- **Headers:** `Content-Type: application/json`

**Body (JSON):**
```json
{
  "amountMYR": 500
}
```

**Response Sukses (200):**
```json
{
  "transactionId": "uuid-xxx",
  "stellarTxHash": "abc123...",
  "amountMYR": 500,
  "amountTESTUSD": "110.0000000",
  "bonusUSDC": "10.0000000",
  "exchangeRate": 0.22,
  "recipientStellarAddress": "GABC123...XYZ"
}
```

> **Batas:** Maksimal 50,000 MYR per transaksi.
> **Bonus:** Setiap Top-Up MYR, user juga otomatis menerima **10 USDC** gratis yang dikirim langsung ke dompet mereka (ditujukan untuk dicoba pada fitur Tabungan Blend).

---

## 5. 🔒 Kirim TESTUSD (Split Disbursement via Soroban)

Mengirim TESTUSD dari pengirim ke satu atau banyak penerima dalam satu transaksi atomik. Dieksekusi melalui **Smart Contract Soroban** di blockchain. Total `percentageBps` dari semua penerima **harus persis 10000** (= 100%).

- **Method:** `POST`
- **URL:** `http://localhost:3001/api/transactions/send`
- **Auth:** `Bearer {{jwt_token}}`
- **Headers:** `Content-Type: application/json`

**Body (JSON) — Contoh kirim ke 3 penerima:**
```json
{
  "totalAmountTestusd": "100",
  "recipients": [
    {
      "stellarAddress": "GAAA...ISTRI",
      "percentageBps": 6000
    },
    {
      "stellarAddress": "GBBB...IBU",
      "percentageBps": 3000
    },
    {
      "stellarAddress": "GCCC...ADIK",
      "percentageBps": 1000
    }
  ]
}
```

**Body (JSON) — Contoh kirim ke 1 penerima:**
```json
{
  "totalAmountTestusd": "50",
  "recipients": [
    {
      "stellarAddress": "GAAA...PENERIMA",
      "percentageBps": 10000
    }
  ]
}
```

**Response Sukses (200):**
```json
{
  "transactionId": "uuid-yyy",
  "stellarTxHash": "def456...",
  "status": "completed"
}
```

> ⚠️ **Catatan:** Karena melalui Soroban, request ini mungkin memakan waktu 3-10 detik untuk menunggu konfirmasi dari blockchain. Tampilkan loading state di UI!

---

## 6. 🔒 Cek Status Transaksi

Mengambil detail dan status terkini dari sebuah transaksi berdasarkan ID-nya.

- **Method:** `GET`
- **URL:** `http://localhost:3001/api/transactions/:id`
- **Auth:** `Bearer {{jwt_token}}`
- **Contoh URL:** `http://localhost:3001/api/transactions/uuid-yyy`

**Response Sukses (200):**
```json
{
  "id": "uuid-yyy",
  "status": "completed",
  "stellar_tx_hash": "def456...",
  "total_amount": 100,
  "failure_reason": null,
  "created_at": "2026-07-08T10:00:00Z",
  "completed_at": "2026-07-08T10:00:05Z",
  "transaction_recipients": [
    {
      "receiver_stellar_address": "GAAA...ISTRI",
      "percentage_bps": 6000,
      "amount": 60
    }
  ]
}
```

> **Status yang mungkin:** `pending` → `submitted` → `completed` atau `failed`

---

## 7. Stellar TOML (Metadata Anchor)

File metadata standar Stellar yang diperlukan agar wallet lain bisa mengenali backend kita sebagai Anchor.

- **Method:** `GET`
- **URL:** `http://localhost:3001/.well-known/stellar.toml`
- **Auth:** Tidak perlu

**Response:** Plain text TOML (bukan JSON)

---

## 8. 🔒 Inisiasi Off-Ramp (SEP-24)

Memulai proses penarikan dana (Off-Ramp) sesuai standar protokol Stellar SEP-24. Mengembalikan URL form pengisian data bank.

- **Method:** `POST`
- **URL:** `http://localhost:3001/sep24/transactions/withdraw/interactive`
- **Auth:** `Bearer {{jwt_token}}`
- **Body:** *(Tidak perlu body)*

**Response Sukses (200):**
```json
{
  "type": "interactive_customer_info_needed",
  "url": "http://localhost:3000/withdraw-form?session=sep24-1234567890",
  "id": "sep24-1234567890"
}
```

---

## 9. 🔒 Submit Off-Ramp ke Bank (Pencairan IDR)

Mengeksekusi pencairan TESTUSD menjadi IDR yang ditransfer ke rekening bank penerima di Indonesia. Kurs statis: **1 TESTUSD = Rp 15,800 IDR**.

- **Method:** `POST`
- **URL:** `http://localhost:3001/api/offramp/submit-bank`
- **Auth:** `Bearer {{jwt_token}}`
- **Headers:** `Content-Type: application/json`

**Body (JSON):**
```json
{
  "bankCode": "BCA",
  "accountNumber": "1234567890",
  "accountName": "Siti Aminah",
  "amountTESTUSD": 50
}
```

**Bank yang didukung:** `BCA`, `MANDIRI`, `BNI`, `BRI`, `PERMATA`

**Response Sukses (200):**
```json
{
  "message": "Off-ramp berhasil diproses.",
  "data": {
    "transactionId": "uuid-zzz",
    "stellarTxHash": null,
    "amountTESTUSD": 50,
    "amountIDR": 790000,
    "exchangeRate": 15800,
    "bankCode": "BCA",
    "accountNumber": "1234567890",
    "accountName": "Siti Aminah",
    "status": "completed"
  }
}
```

---

## 10. 🔒 Dashboard (Beranda & Riwayat)

Endpoint utama untuk halaman beranda. Satu panggilan menghasilkan semua data yang dibutuhkan UI: info wallet, metrik penghematan, dan riwayat lengkap.

- **Method:** `GET`
- **URL:** `http://localhost:3001/api/dashboard`
- **Auth:** `Bearer {{jwt_token}}`

**Response Sukses (200):**
```json
{
  "data": {
    "wallet": {
      "stellarAddress": "GABC123...XYZ"
    },
    "metrics": {
      "totalTransactions": 5,
      "totalOnRampMYR": 1000,
      "totalDisbursedUSD": 220,
      "totalOffRampIDR": 3476000,
      "totalSavedUSD": 10.56,
      "traditionalFeePercent": 4.8,
      "kirimFeePercent": 0
    },
    "history": [
      {
        "id": "uuid-xxx",
        "txType": "disbursement",
        "totalAmount": 100,
        "exchangeRate": null,
        "status": "completed",
        "stellarTxHash": "abc123...",
        "createdAt": "2026-07-08T10:00:00Z",
        "completedAt": "2026-07-08T10:00:05Z",
        "recipients": [
          {
            "receiverStellarAddress": "GAAA...ISTRI",
            "percentageBps": 6000,
            "amount": 60
          }
        ]
      },
      {
        "id": "uuid-yyy",
        "txType": "onramp",
        "totalAmount": 110,
        "exchangeRate": 0.22,
        "status": "completed",
        "stellarTxHash": "def456...",
        "createdAt": "2026-07-07T09:00:00Z",
        "completedAt": "2026-07-07T09:00:03Z"
      }
    ]
  }
}
```

> **txType yang mungkin:** `onramp`, `disbursement`, `offramp`

---

## 11. 🔒 Deposit ke Tabungan Blend (On-Chain)

Mendeposit TESTUSD/USDC ke protokol Blend melalui Smart Contract Soroban. Backend akan memanggil fungsi `deposit_to_blend` di kontrak Kirim, yang kemudian memanggil Blend Pool secara cross-contract.

- **Method:** `POST`
- **URL:** `http://localhost:3001/api/savings/deposit`
- **Auth:** `Bearer {{jwt_token}}`
- **Headers:** `Content-Type: application/json`

**Body (JSON):**
```json
{
  "amount": 100
}
```

**Response Sukses (201):**
```json
{
  "message": "Berhasil deposit ke Blend on-chain.",
  "data": {
    "totalDeposited": 100,
    "stellarTxHash": "ghi789..."
  }
}
```

> ⚠️ **Catatan:** Sama seperti endpoint kirim, request ini memakan waktu 3-10 detik. Tampilkan loading state di UI!

---

## 12. 🔒 Tarik Tabungan

Menarik dana dari saldo tabungan.

- **Method:** `POST`
- **URL:** `http://localhost:3001/api/savings/withdraw`
- **Auth:** `Bearer {{jwt_token}}`
- **Headers:** `Content-Type: application/json`

**Body (JSON):**
```json
{
  "amount": 50
}
```

**Response Sukses (200):**
```json
{
  "message": "Berhasil menarik dari tabungan.",
  "data": {
    "remainingDeposit": 50
  }
}
```

---

## 13. 🔒 Cek Saldo Tabungan & Yield Real-Time

Mengambil posisi tabungan user beserta simulasi yield yang berjalan setiap detik. Panggil endpoint ini secara polling (misalnya setiap 3 detik) untuk efek angka bunga yang terus bertambah di UI.

- **Method:** `GET`
- **URL:** `http://localhost:3001/api/savings`
- **Auth:** `Bearer {{jwt_token}}`

**Response jika belum ada tabungan:**
```json
{
  "message": "Belum ada posisi tabungan.",
  "data": null
}
```

**Response jika ada tabungan (200):**
```json
{
  "message": "Posisi tabungan berhasil diambil.",
  "data": {
    "userId": "uuid-user",
    "amountDeposited": 100,
    "currentValue": 100.0000027,
    "yieldEarned": 0.0000027,
    "apyPercentage": 8.5,
    "depositedAt": "2026-07-08T10:00:00Z",
    "onChain": true
  }
}
```

> **💡 Tip animasi:** Panggil endpoint ini setiap 2-3 detik dan tampilkan `currentValue` dengan animasi counter naik untuk efek "bunga berjalan real-time" yang sangat memukau saat demo!

---

## 🧪 Urutan Testing di Postman (Happy Path)

Ikuti urutan ini untuk simulasi end-to-end lengkap:

1. **[Sekali]** Dapatkan JWT Token dari Supabase
2. **[Sekali]** `POST /api/wallets/provision` — Buat wallet
3. `POST /api/onramp/simulate` — Top-up 500 MYR → 110 TESTUSD
4. `POST /api/transactions/send` — Kirim ke 3 penerima
5. `GET /api/transactions/:id` — Verifikasi status transaksi
6. `POST /api/offramp/submit-bank` — Cairkan 50 TESTUSD ke BCA
7. `POST /api/savings/deposit` — Deposit 30 TESTUSD ke Blend
8. `GET /api/savings` — Lihat saldo + yield (panggil beberapa kali!)
9. `GET /api/dashboard` — Lihat ringkasan semua aktivitas

---

## ❌ Format Error Response

Semua error mengikuti format yang konsisten:

```json
{
  "error": "Bad Request",
  "message": "Keterangan error yang jelas dalam bahasa Indonesia"
}
```

| HTTP Status | Artinya |
|-------------|---------|
| 400 | Input tidak valid (field kurang, tipe salah, dll) |
| 401 | Token tidak ada atau sudah expired |
| 404 | Data tidak ditemukan |
| 500 | Error server (cek log backend) |

---

## 📡 WebSocket API (Real-Time Notifications)

Backend mendukung koneksi WebSocket via **Socket.io** untuk mengirim notifikasi secara *real-time* tanpa perlu di-*refresh* oleh pengguna.

### 1. Cara Menghubungkan WebSocket
Gunakan pustaka `socket.io-client` di sisi frontend. Anda wajib mengirimkan Supabase JWT token saat inisialisasi agar server mengetahui identitas Anda.

```javascript
import { io } from "socket.io-client";

// Inisialisasi koneksi dengan token
const socket = io("http://localhost:3001", {
  auth: { token: "<SUPABASE_JWT_TOKEN>" }
});

socket.on("connect", () => {
  console.log("Terhubung ke server notifikasi!");
});
```

### 2. Daftar Event yang Dipancarkan (Emitted) Server

| Nama Event | Pemicu (Trigger) | Payload (Data) |
|------------|------------------|----------------|
| `onramp:completed` | Saat berhasil Top-up MYR | `{ transactionId, stellarTxHash, amountMYR, amountTESTUSD, bonusUSDC }` |
| `transaction:completed` | Saat pengirim berhasil mengirim uang | `{ transactionId, stellarTxHash, totalAmount, recipients }` |
| `transaction:received` | Saat penerima mendapatkan kiriman uang | `{ transactionId, stellarTxHash, amount, from }` |
| `offramp:completed` | Saat proses pencairan bank berhasil | `{ transactionId, amountTESTUSD, amountIDR, bankCode }` |
| `savings:deposited` | Saat berhasil menabung di Blend | `{ totalDeposited, stellarTxHash }` |

**Contoh menangkap event:**
```javascript
socket.on("onramp:completed", (data) => {
  alert(`Uang masuk! Transaksi ID: ${data.transactionId}`);
  // Lakukan update state UI (misal panggil GET /api/dashboard ulang)
});
```
