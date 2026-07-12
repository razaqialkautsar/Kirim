import {
  Keypair,
  TransactionBuilder,
  Operation,
  BASE_FEE,
} from "@stellar/stellar-sdk";
import { supabase } from "../config/supabase.js";
import {
  server,
  NETWORK_PASSPHRASE,
  TESTUSD_ASSET,
  USDC_ASSET,
} from "../config/stellar.js";
import { getWalletByUserId } from "./wallet.service.js";
import { emitToUser } from "../config/socket.js";

// ---------------------------------------------------------------------------
// Kurs statis untuk simulasi (Hackathon demo)
// Sumber referensi: rata-rata kurs Q2 2026 — 1 MYR ≈ 0.22 USD
// Di produksi nyata, ini akan diganti dengan API kurs real-time.
// ---------------------------------------------------------------------------
const EXCHANGE_RATE_MYR_TO_USD = 0.22;

export interface OnRampResult {
  transactionId: string;
  stellarTxHash: string;
  amountMYR: number;
  amountTESTUSD: string;
  bonusUSDC: string;
  exchangeRate: number;
  recipientStellarAddress: string;
}

/**
 * Simulasikan proses On-Ramp: Pengirim (PMI Malaysia) menyetorkan MYR,
 * lalu backend mengonversinya ke TESTUSD dan mengirimkan ke dompet
 * Stellar milik pengirim tersebut.
 *
 * Di dunia nyata, bagian ini dilakukan oleh PJP/Money Changer berlisensi
 * yang menerima uang tunai Ringgit, lalu mengirim stablecoin ke user.
 * Di demo hackathon, kita simulasikan ini dari akun Distributor.
 *
 * @param userId - UUID user pengirim (dari Supabase Auth)
 * @param amountMYR - Jumlah Ringgit Malaysia yang disetorkan
 */
export async function simulateOnRamp(
  userId: string,
  amountMYR: number
): Promise<OnRampResult> {
  // --- Validasi input ---
  if (!amountMYR || amountMYR <= 0) {
    throw new Error("amountMYR harus angka positif.");
  }

  if (amountMYR > 50000) {
    throw new Error(
      "Batas maksimal simulasi on-ramp adalah 50,000 MYR per transaksi."
    );
  }

  // --- Cek wallet sender ---
  const senderWallet = await getWalletByUserId(userId);
  if (!senderWallet) {
    throw new Error(
      `User ${userId} belum punya Stellar wallet. Jalankan /api/wallets/provision dulu.`
    );
  }

  // --- Hitung konversi MYR → TESTUSD ---
  const amountTESTUSD = (amountMYR * EXCHANGE_RATE_MYR_TO_USD).toFixed(7);

  // --- Ambil akun Distributor (sumber TESTUSD) ---
  const distributorSecret = process.env.TESTUSD_DISTRIBUTOR_SECRET_KEY;
  if (!distributorSecret) {
    throw new Error(
      "TESTUSD_DISTRIBUTOR_SECRET_KEY belum diisi di .env. " +
        "Jalankan `npm run setup:testusd` dulu."
    );
  }
  const distributorKeypair = Keypair.fromSecret(distributorSecret);

  // --- Ambil akun Faucet USDC (bonus) ---
  const usdcFaucetSecret = process.env.USDC_DEMO_ACCOUNT_SECRET_KEY;
  if (!usdcFaucetSecret) {
    throw new Error("USDC_DEMO_ACCOUNT_SECRET_KEY belum diisi di .env.");
  }
  const usdcFaucetKeypair = Keypair.fromSecret(usdcFaucetSecret);

  // --- Build transaksi Stellar ---
  const distributorAccount = await server.loadAccount(
    distributorKeypair.publicKey()
  );

  const transaction = new TransactionBuilder(distributorAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.payment({
        destination: senderWallet.stellar_public_key,
        asset: TESTUSD_ASSET,
        amount: amountTESTUSD,
      })
    )
    .addOperation(
      Operation.payment({
        source: usdcFaucetKeypair.publicKey(),
        destination: senderWallet.stellar_public_key,
        asset: USDC_ASSET,
        amount: "10.0000000",
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(distributorKeypair);
  transaction.sign(usdcFaucetKeypair);

  // --- Submit ke Stellar Horizon ---
  let txHash: string;
  try {
    const result = await server.submitTransaction(transaction);
    txHash = result.hash;
    console.log(
      `[onramp] On-ramp sukses: ${amountMYR} MYR → ${amountTESTUSD} TESTUSD | tx: ${txHash}`
    );
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Submit transaksi on-ramp gagal: ${reason}`);
  }

  // --- Simpan record ke database ---
  const { data: txRecord, error: insertError } = await supabase
    .from("transactions")
    .insert({
      sender_id: userId,
      total_amount: parseFloat(amountTESTUSD),
      status: "completed",
      exchange_rate: EXCHANGE_RATE_MYR_TO_USD,
      stellar_tx_hash: txHash,
      tx_type: "onramp",
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError || !txRecord) {
    // Transaksi Stellar sudah berhasil, tapi gagal simpan ke DB — log warning
    console.warn(
      `[onramp] PERINGATAN: Transaksi Stellar sukses (${txHash}), tapi gagal simpan ke DB: ${insertError?.message}`
    );
  }

  // --- Kirim notifikasi WebSocket ---
  emitToUser(userId, "onramp:completed", {
    transactionId: txRecord?.id ?? "unknown",
    stellarTxHash: txHash,
    amountMYR,
    amountTESTUSD,
    bonusUSDC: "10.0000000"
  });

  return {
    transactionId: txRecord?.id ?? "unknown",
    stellarTxHash: txHash,
    amountMYR,
    amountTESTUSD,
    bonusUSDC: "10.0000000",
    exchangeRate: EXCHANGE_RATE_MYR_TO_USD,
    recipientStellarAddress: senderWallet.stellar_public_key,
  };
}
