import { supabase } from "../config/supabase.js";

// ---------------------------------------------------------------------------
// Konstanta untuk kalkulasi penghematan biaya
// ---------------------------------------------------------------------------
// Sumber: PRD Kirim — rata-rata biaya koridor Malaysia → Indonesia: 4.80%
// Beberapa provider tradisional bahkan mengenakan biaya hingga 12%+
const TRADITIONAL_FEE_PERCENT = 4.8;

// Biaya Stellar per transaksi: 0.00001 XLM ≈ $0.000003 (nyaris gratis)
// Untuk demo, kita bulatkan jadi 0% agar perbandingan lebih dramatis
const KIRIM_FEE_PERCENT = 0;

export interface DashboardData {
  wallet: {
    stellarAddress: string;
  } | null;
  metrics: {
    totalTransactions: number;
    totalOnRampMYR: number;       // Total MYR yang pernah disetor
    totalDisbursedUSD: number;    // Total TESTUSD yang pernah dikirim ke keluarga
    totalOffRampIDR: number;      // Total IDR yang pernah dicairkan
    totalSavedUSD: number;        // Uang yang dihemat vs bank tradisional
    traditionalFeePercent: number;
    kirimFeePercent: number;
  };
  history: TransactionHistoryItem[];
}

export interface TransactionHistoryItem {
  id: string;
  txType: string;           // 'onramp' | 'disbursement' | 'offramp'
  totalAmount: number;
  exchangeRate: number | null;
  status: string;
  stellarTxHash: string | null;
  createdAt: string;
  completedAt: string | null;
  // Khusus disbursement: detail penerima
  recipients?: {
    receiverStellarAddress: string;
    percentageBps: number;
    amount: number;
  }[];
}

/**
 * Ambil seluruh data dashboard untuk seorang user.
 *
 * Data yang dikembalikan:
 * 1. Alamat wallet Stellar milik user
 * 2. Metrik ringkasan (total transaksi, penghematan biaya, dll)
 * 3. Riwayat transaksi lengkap (on-ramp, disbursement, off-ramp)
 *
 * @param userId - UUID user dari Supabase Auth
 */
export async function getDashboardData(userId: string): Promise<DashboardData> {
  // --- 1. Ambil wallet ---
  const { data: walletData } = await supabase
    .from("stellar_wallets")
    .select("stellar_public_key")
    .eq("user_id", userId)
    .maybeSingle();

  // --- 2. Ambil seluruh riwayat transaksi ---
  const { data: transactions, error: txError } = await supabase
    .from("transactions")
    .select(`
      id,
      tx_type,
      total_amount,
      exchange_rate,
      status,
      stellar_tx_hash,
      created_at,
      completed_at,
      transaction_recipients (
        receiver_stellar_address,
        percentage_bps,
        amount
      )
    `)
    .eq("sender_id", userId)
    .order("created_at", { ascending: false });

  if (txError) {
    throw new Error(`Gagal mengambil riwayat transaksi: ${txError.message}`);
  }

  const txList = transactions ?? [];

  // --- 3. Hitung metrik ---
  let totalOnRampMYR = 0;
  let totalDisbursedUSD = 0;
  let totalOffRampIDR = 0;
  let completedCount = 0;

  for (const tx of txList) {
    if (tx.status !== "completed") continue;
    completedCount++;

    const amount = Number(tx.total_amount);
    const rate = Number(tx.exchange_rate) || 0;

    switch (tx.tx_type) {
      case "onramp":
        // total_amount menyimpan TESTUSD yang diterima, rate = MYR→USD
        // Jadi MYR asli = TESTUSD / rate
        if (rate > 0) {
          totalOnRampMYR += amount / rate;
        }
        break;
      case "disbursement":
        totalDisbursedUSD += amount;
        break;
      case "offramp":
        // total_amount menyimpan TESTUSD yang ditarik, rate = USD→IDR
        totalOffRampIDR += amount * rate;
        break;
    }
  }

  // Hitung penghematan:
  // Jika user mengirim X USD via bank tradisional, biayanya = X * 4.8%
  // Via Kirim, biayanya ≈ 0. Jadi penghematan = X * 4.8%
  const totalSavedUSD = totalDisbursedUSD * (TRADITIONAL_FEE_PERCENT / 100);

  // --- 4. Format riwayat transaksi ---
  const history: TransactionHistoryItem[] = txList.map((tx) => {
    const item: TransactionHistoryItem = {
      id: tx.id,
      txType: tx.tx_type,
      totalAmount: Number(tx.total_amount),
      exchangeRate: tx.exchange_rate ? Number(tx.exchange_rate) : null,
      status: tx.status,
      stellarTxHash: tx.stellar_tx_hash,
      createdAt: tx.created_at,
      completedAt: tx.completed_at,
    };

    // Sertakan detail penerima untuk transaksi tipe disbursement
    if (tx.tx_type === "disbursement" && tx.transaction_recipients) {
      item.recipients = (tx.transaction_recipients as any[]).map((r) => ({
        receiverStellarAddress: r.receiver_stellar_address,
        percentageBps: r.percentage_bps,
        amount: Number(r.amount),
      }));
    }

    return item;
  });

  return {
    wallet: walletData
      ? { stellarAddress: walletData.stellar_public_key }
      : null,
    metrics: {
      totalTransactions: completedCount,
      totalOnRampMYR: Math.round(totalOnRampMYR * 100) / 100,
      totalDisbursedUSD: Math.round(totalDisbursedUSD * 100) / 100,
      totalOffRampIDR: Math.round(totalOffRampIDR),
      totalSavedUSD: Math.round(totalSavedUSD * 100) / 100,
      traditionalFeePercent: TRADITIONAL_FEE_PERCENT,
      kirimFeePercent: KIRIM_FEE_PERCENT,
    },
    history,
  };
}
