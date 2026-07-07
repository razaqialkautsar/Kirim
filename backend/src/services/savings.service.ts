import { supabase } from "../config/supabase.js";

// ================================================================
// Konstanta Simulasi
// ================================================================
// APY 8.5% per tahun — dipecah ke skala detik agar saat UI
// melakukan polling setiap 2 detik, angka yield terlihat naik.
const MOCK_APY_PERCENT = 8.5;
const SECONDS_IN_YEAR = 365.25 * 24 * 60 * 60; // 31,557,600 detik
const APY_PER_SECOND = MOCK_APY_PERCENT / 100 / SECONDS_IN_YEAR;

// ================================================================
// Interface
// ================================================================
export interface SavingsPosition {
  userId: string;
  amountDeposited: number;
  currentValue: number;
  yieldEarned: number;
  apyPercentage: number;
  depositedAt: string;
}

// ================================================================
// depositToSavings
// ================================================================
/**
 * Mencatat deposit XLM ke tabungan simulasi.
 * Jika user sudah punya posisi, saldo ditambahkan (akumulatif).
 * Jika belum, buat posisi baru.
 */
export async function depositToSavings(
  userId: string,
  amount: number
): Promise<{ totalDeposited: number }> {
  if (amount <= 0) {
    throw new Error("Jumlah deposit harus lebih besar dari 0.");
  }

  // Cek apakah sudah ada posisi sebelumnya
  const { data: existing } = await supabase
    .from("savings_positions")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (existing) {
    // Tambahkan ke saldo yang ada
    const newTotal = parseFloat(existing.amount_deposited) + amount;
    const { error } = await supabase
      .from("savings_positions")
      .update({
        amount_deposited: newTotal,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) throw new Error(`Gagal update tabungan: ${error.message}`);
    return { totalDeposited: newTotal };
  }

  // Buat posisi baru
  const { error } = await supabase.from("savings_positions").insert({
    user_id: userId,
    amount_deposited: amount,
  });

  if (error) throw new Error(`Gagal membuat posisi tabungan: ${error.message}`);
  return { totalDeposited: amount };
}

// ================================================================
// withdrawFromSavings
// ================================================================
/**
 * Menarik dana dari tabungan simulasi.
 * Jika sisa saldo = 0 setelah penarikan, posisi dihapus.
 */
export async function withdrawFromSavings(
  userId: string,
  amount: number
): Promise<{ remainingDeposit: number }> {
  if (amount <= 0) {
    throw new Error("Jumlah penarikan harus lebih besar dari 0.");
  }

  const { data: existing } = await supabase
    .from("savings_positions")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!existing) {
    throw new Error("Tidak ada posisi tabungan ditemukan untuk user ini.");
  }

  const currentDeposit = parseFloat(existing.amount_deposited);
  if (amount > currentDeposit) {
    throw new Error(
      `Saldo tabungan tidak mencukupi. Saldo saat ini: ${currentDeposit} XLM.`
    );
  }

  const remaining = currentDeposit - amount;

  if (remaining === 0) {
    // Hapus posisi jika saldo habis
    await supabase.from("savings_positions").delete().eq("id", existing.id);
    return { remainingDeposit: 0 };
  }

  // Kurangi saldo
  const { error } = await supabase
    .from("savings_positions")
    .update({
      amount_deposited: remaining,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);

  if (error) throw new Error(`Gagal update tabungan: ${error.message}`);
  return { remainingDeposit: remaining };
}

// ================================================================
// getSavingsPosition
// ================================================================
/**
 * Mengambil posisi tabungan user dan menghitung bunga (yield)
 * berdasarkan selisih waktu antara deposited_at dan sekarang.
 *
 * Rumus:
 *   yieldEarned = amountDeposited × APY_PER_SECOND × elapsedSeconds
 *   currentValue = amountDeposited + yieldEarned
 *
 * Efek: Setiap kali UI memanggil endpoint ini, angka currentValue
 * akan sedikit lebih besar dari panggilan sebelumnya — memberikan
 * ilusi bunga berjalan real-time.
 */
export async function getSavingsPosition(
  userId: string
): Promise<SavingsPosition | null> {
  const { data: position } = await supabase
    .from("savings_positions")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!position) {
    return null;
  }

  const amountDeposited = parseFloat(position.amount_deposited);
  const depositedAt = new Date(position.deposited_at);
  const now = new Date();

  // Hitung selisih waktu dalam detik
  const elapsedSeconds = (now.getTime() - depositedAt.getTime()) / 1000;

  // Hitung yield berdasarkan waktu
  const yieldEarned = amountDeposited * APY_PER_SECOND * elapsedSeconds;
  const currentValue = amountDeposited + yieldEarned;

  return {
    userId,
    amountDeposited,
    currentValue: parseFloat(currentValue.toFixed(7)),
    yieldEarned: parseFloat(yieldEarned.toFixed(7)),
    apyPercentage: MOCK_APY_PERCENT,
    depositedAt: position.deposited_at,
  };
}
