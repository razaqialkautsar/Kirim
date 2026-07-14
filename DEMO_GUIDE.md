# Panduan Demo Kirim (APAC Stellar Hackathon)

Dokumen ini berisi panduan langkah demi langkah untuk melakukan demonstrasi aplikasi **Kirim** dengan lancar. Pastikan semua prasyarat dipenuhi sebelum memulai demo di depan juri atau rekan tim.

---

## 1. Persiapan Awal (Prasyarat)

Pastikan kamu sudah menginstal Node.js dan melakukan instalasi dependensi di kedua *folder* utama:

```bash
# Terminal 1 - Backend
cd backend
npm install

# Terminal 2 - Frontend
cd frontend
npm install
```

Pastikan kamu juga sudah memiliki *database* Supabase dan pengaturan variabel lingkungan (`.env`) yang benar, baik di `backend/.env` maupun di `frontend/.env`.

---

## 2. Setup Dompet Treasury (Wajib Sebelum Demo)

Aplikasi Kirim menggunakan konsep **Treasury** sebagai dompet pusat yang memegang cadangan aset (XLM, TESTUSD, dll) untuk memfasilitasi transaksi tanpa biaya gas bagi pengguna akhir. 

Jika ini adalah lingkungan *testnet* baru, ikuti langkah ini:

1. **Buat dan Danai Treasury:**
   - Dapatkan dompet baru untuk Treasury.
   - Buka [Stellar Laboratory Faucet](https://laboratory.stellar.org/#account-creator?network=test) dan masukkan alamat *public key* Treasury kamu untuk mendapatkan saldo XLM awal (untuk membayar biaya transaksi).
2. **Masukkan ke Backend:**
   - Buka `backend/.env`.
   - Masukkan *secret key* dompet tersebut ke dalam `TREASURY_SECRET_KEY`.
3. **Konfigurasi Aset:**
   - Pastikan variabel `ISSUER_SECRET_KEY` juga sudah diset (ini adalah dompet yang mencetak uang TESTUSD).
   - *Opsional (Jika belum pernah)*: Jalankan perintah ini di dalam folder `backend` untuk menghubungkan *trustline* TESTUSD ke Treasury.
     ```bash
     npm run setup:testusd
     ```

*(Catatan: Pastikan dompet Treasury memiliki saldo USDC (Blend Testnet) yang cukup. USDC dapat diperoleh dari faucet di [testnet.blend.capital](https://testnet.blend.capital) — klik tombol "receive assets for Blend test network". Treasury juga memerlukan saldo XLM dari Stellar Laboratory Faucet untuk membayar biaya transaksi).*

---

## 3. Menjalankan Aplikasi

Jalankan *backend* dan *frontend* di dua terminal yang berbeda.

**Terminal 1 (Backend):**
```bash
cd backend
npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

Buka URL lokal yang muncul di terminal (biasanya `http://localhost:5173`) di *browser* kamu.

---

## 4. Alur Demonstrasi (Demo Flow)

Saat mempresentasikan aplikasi Kirim, ikuti alur skenario berikut agar juri dapat memahami nilai dari aplikasi ini:

### Langkah A: Login & Registrasi Otomatis
- Gunakan fitur Auth yang ada (bisa mendaftar akun baru dengan email fiktif atau gunakan akun yang sudah ada).
- **Poin Demo:** Jelaskan bahwa aplikasi ini membuatkan *wallet* Stellar secara otomatis di latar belakang. Pengguna tidak perlu repot menyimpan 24-word *seed phrase* (konsep *Custodial-lite wallet*).

### Langkah B: Top Up (On-Ramp)
- Buka **Tab Top Up** (ikon panah bawah di *sidebar*).
- Masukkan jumlah Ringgit Malaysia (MYR) yang ingin didepositkan.
- Klik **Bayar via FPX**.
- **Poin Demo:** Tunjukkan bahwa saldo TESTUSD (aset representasi dolar AS di Stellar) langsung bertambah secara instan.

### Langkah C: Menabung di Blend (Yield)
- Buka tab **Tabungan Blend**.
- Masukkan sebagian dari saldo TESTUSD yang baru saja di-*top up*.
- Klik **Deposit**.
- **Poin Demo:** Jelaskan bahwa uang pengguna kini diputar di protokol DeFi sesungguhnya (Blend Protocol) untuk mendapatkan bunga *real-time* (~0.06% APY) secara *on-chain*, namun pengalaman UI tetap se-simpel aplikasi perbankan biasa. Transaksi deposit dan withdraw sepenuhnya terjadi *on-chain* melalui *Smart Contract* Soroban.

### Langkah D: Mengirim Uang Lintas Negara
- Buka tab **Kirim**.
- Masukkan jumlah uang dan *public key* penerima (bisa menggunakan *wallet* keluarga di Indonesia).
- **Poin Demo:** Tekankan penghematan biaya. Kirim memotong perantara bank tradisional sehingga *fee* hampir $0 (karena menggunakan *gasless transaction* dari Treasury kita), jauh lebih murah dari *remittance* tradisional yang memakan biaya ~4.8%.

### Langkah E: Pencairan (Off-Ramp)
- Buka tab **Cairkan**.
- Masukkan jumlah TESTUSD untuk dikonversi ke Rupiah (IDR).
- **Poin Demo:** Uang cair langsung masuk ke rekening penerima (simulasi) hanya dalam hitungan detik berkat keandalan jaringan Stellar.

---

Semoga sukses dengan demonya! 🚀
