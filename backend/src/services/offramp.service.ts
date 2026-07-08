import { supabase } from "../config/supabase.js";
import { getWalletByUserId } from "./wallet.service.js";
import { emitToUser } from "../config/socket.js";

// ---------------------------------------------------------------------------
// Kurs statis Off-Ramp: 1 TESTUSD ≈ Rp15.000
// Di produksi nyata, ini akan diganti dengan API kurs real-time dari PJP.
// ---------------------------------------------------------------------------
const EXCHANGE_RATE_USD_TO_IDR = 15000;

export interface BankSubmitInput {
  bankCode: string;       // Kode bank tujuan: "BCA", "MANDIRI", "BRI", dsb.
  accountNumber: string;  // Nomor rekening penerima di Indonesia
  accountName: string;    // Nama pemilik rekening (untuk validasi tampilan)
}

export interface OffRampResult {
  offrampTxId: string;
  amountTESTUSD: number;
  amountIDR: number;
  exchangeRate: number;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  bankRef: string;
  message: string;
}

/**
 * Simulasi API Bank Lokal Indonesia (PJP / Payment Gateway).
 *
 * Di dunia nyata, ini adalah panggilan HTTPS ke API milik mitra bank
 * (contoh: Xendit, Flip, atau API bank langsung) untuk mentransfer Rupiah.
 *
 * Untuk demo hackathon, kita simulasikan dengan delay 2 detik dan
 * selalu mengembalikan status sukses.
 */
async function mockBankTransfer(
  bankCode: string,
  accountNumber: string,
  accountName: string,
  amountIDR: number
): Promise<{ status: "success"; refNumber: string }> {
  console.log(
    `[mock-bank] Memulai transfer Rp${amountIDR.toLocaleString("id-ID")} ` +
    `ke ${bankCode} ${accountNumber} a.n. ${accountName}...`
  );

  // Simulasi network delay dari bank (2 detik)
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Generate nomor referensi acak
  const refNumber = `REF-${bankCode}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  console.log(`[mock-bank] Transfer sukses! Ref: ${refNumber}`);

  return { status: "success", refNumber };
}

/**
 * Proses Off-Ramp: Cairkan TESTUSD menjadi Rupiah (IDR) ke rekening bank lokal.
 *
 * Flow:
 * 1. Validasi input (jumlah, data bank)
 * 2. Hitung konversi TESTUSD → IDR menggunakan kurs statis
 * 3. Panggil Mock Bank API (simulasi transfer Rupiah)
 * 4. Catat transaksi ke database dengan tx_type = 'offramp'
 *
 * @param userId - UUID user yang melakukan penarikan (dari Supabase Auth)
 * @param input - Data rekening bank tujuan
 * @param amountTESTUSD - Jumlah TESTUSD yang ingin dicairkan
 */
export async function processOffRamp(
  userId: string,
  input: BankSubmitInput,
  amountTESTUSD: number
): Promise<OffRampResult> {
  // --- Validasi Input ---
  if (!amountTESTUSD || amountTESTUSD <= 0) {
    throw new Error("Jumlah penarikan harus lebih dari 0 TESTUSD.");
  }

  if (!input.bankCode || !input.accountNumber || !input.accountName) {
    throw new Error("bankCode, accountNumber, dan accountName wajib diisi.");
  }

  const allowedBanks = ["BCA", "MANDIRI", "BRI", "BNI", "BSI", "CIMB"];
  if (!allowedBanks.includes(input.bankCode.toUpperCase())) {
    throw new Error(
      `Bank '${input.bankCode}' tidak didukung. Pilihan: ${allowedBanks.join(", ")}`
    );
  }

  // --- Hitung konversi TESTUSD → IDR ---
  const amountIDR = amountTESTUSD * EXCHANGE_RATE_USD_TO_IDR;

  // --- Panggil Mock Bank API ---
  const bankResult = await mockBankTransfer(
    input.bankCode.toUpperCase(),
    input.accountNumber,
    input.accountName,
    amountIDR
  );

  // --- Catat ke Database ---
  const { data: record, error: insertError } = await supabase
    .from("transactions")
    .insert({
      sender_id: userId,
      total_amount: amountTESTUSD,
      status: "completed",
      tx_type: "offramp",
      exchange_rate: EXCHANGE_RATE_USD_TO_IDR,
      stellar_tx_hash: bankResult.refNumber, // Gunakan ref bank sebagai penanda
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError || !record) {
    // Transfer bank sudah sukses tapi gagal simpan ke DB — log warning serius
    console.error(
      `[offramp] KRITIS: Transfer bank sukses (${bankResult.refNumber}), ` +
      `tapi gagal simpan ke DB: ${insertError?.message}`
    );
    // Tetap kembalikan hasil sukses karena uang sudah ditransfer
  }

  const resultMessage =
    `Pencairan berhasil! Rp${amountIDR.toLocaleString("id-ID")} ` +
    `sedang dikirim ke ${input.bankCode.toUpperCase()} ${input.accountNumber} ` +
    `a.n. ${input.accountName}`;

  console.log(`[offramp] ${resultMessage}`);

  // --- Kirim notifikasi WebSocket ---
  emitToUser(userId, "offramp:completed", {
    transactionId: record?.id,
    amountTESTUSD,
    amountIDR,
    bankCode: input.bankCode,
  });

  return {
    offrampTxId: record?.id ?? "unknown",
    amountTESTUSD,
    amountIDR,
    exchangeRate: EXCHANGE_RATE_USD_TO_IDR,
    bankCode: input.bankCode.toUpperCase(),
    accountNumber: input.accountNumber,
    accountName: input.accountName,
    bankRef: bankResult.refNumber,
    message: resultMessage,
  };
}
