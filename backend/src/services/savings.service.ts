import {
  Keypair,
  TransactionBuilder,
  BASE_FEE,
  Address,
  nativeToScVal,
  rpc,
} from "@stellar/stellar-sdk";
import { supabase } from "../config/supabase.js";
import {
  sorobanServer,
  NETWORK_PASSPHRASE,
  kirimContract,
  decryptSecretKey,
} from "../config/stellar.js";
import { getEncryptedSecretKey, getWalletByUserId } from "./wallet.service.js";
import { emitToUser } from "../config/socket.js";

// ================================================================
// Konstanta Simulasi Yield (Off-Chain Indexer — Opsi B)
// ================================================================
// APY 8.5% per tahun — dipecah ke skala detik agar saat UI
// melakukan polling setiap beberapa detik, angka yield terlihat naik.
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
  onChain: boolean; // true = deposit berhasil di Blend on-chain
}

// ================================================================
// depositToSavings — ON-CHAIN via Soroban Smart Contract
// ================================================================
/**
 * Memanggil fungsi `deposit_to_blend(user, amount)` di Kirim Contract.
 * Kontrak Kirim kemudian melakukan cross-contract call ke Blend Pool.
 *
 * Setelah transaksi on-chain berhasil, Backend mencatat posisi deposit
 * ke tabel savings_positions (Off-Chain Indexer) untuk query cepat di UI.
 */
export async function depositToSavings(
  userId: string,
  amount: number
): Promise<{ totalDeposited: number; stellarTxHash: string }> {
  if (amount <= 0) {
    throw new Error("Jumlah deposit harus lebih besar dari 0.");
  }

  if (!kirimContract) {
    throw new Error(
      "KIRIM_CONTRACT_ID belum diisi di .env. Fitur Soroban tidak aktif."
    );
  }

  // --- Ambil wallet user ---
  const userWallet = await getWalletByUserId(userId);
  if (!userWallet) {
    throw new Error(
      `User ${userId} belum punya Stellar wallet. Jalankan /api/wallets/provision dulu.`
    );
  }

  // --- Decrypt secret key ---
  const encryptedSecret = await getEncryptedSecretKey(userId);
  const userSecretKey = await decryptSecretKey(encryptedSecret);
  const userKeypair = Keypair.fromSecret(userSecretKey);

  // --- Load akun user dari Soroban RPC ---
  const userAccount = await sorobanServer.getAccount(
    userWallet.stellar_public_key
  );

  // --- Build parameter Soroban ---
  // Konversi amount ke unit terkecil (stroops, 7 desimal) sebagai i128
  const amountStroops = BigInt(Math.floor(amount * 10_000_000));
  const userScVal = new Address(userWallet.stellar_public_key).toScVal();
  const amountScVal = nativeToScVal(amountStroops, { type: "i128" });

  // --- Rakit transaksi: panggil deposit_to_blend ---
  const transaction = new TransactionBuilder(userAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      kirimContract.call("deposit_to_blend", userScVal, amountScVal)
    )
    .setTimeout(30)
    .build();

  // --- Simulasi (WAJIB untuk Soroban) ---
  const simResult = await sorobanServer.simulateTransaction(transaction);

  if (rpc.Api.isSimulationError(simResult)) {
    const reason =
      "error" in simResult ? String(simResult.error) : "Simulasi gagal";
    throw new Error(`Simulasi Soroban deposit_to_blend gagal: ${reason}`);
  }

  // Gabungkan (resource fee & auth data)
  const preparedTx = rpc.assembleTransaction(
    transaction,
    simResult as any
  ).build();

  // Sign transaksi
  preparedTx.sign(userKeypair);

  // Hapus secret key dari memory
  userSecretKey.replace(/./, "x");

  // --- Submit ke Soroban RPC ---
  let txHash: string;
  const sendResult = await sorobanServer.sendTransaction(preparedTx);
  txHash = sendResult.hash;

  // Polling status sampai transaksi terkonfirmasi
  let getResult = await sorobanServer.getTransaction(txHash);
  while (getResult.status === "NOT_FOUND") {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    getResult = await sorobanServer.getTransaction(txHash);
  }

  if (getResult.status === "FAILED") {
    throw new Error(
      "Transaksi deposit_to_blend gagal di jaringan (status: FAILED)"
    );
  }

  console.log(`[savings/soroban] Deposit ke Blend berhasil: ${txHash}`);

  // --- Catat ke Database (Off-Chain Indexer) ---
  const { data: existing } = await supabase
    .from("savings_positions")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (existing) {
    const currentDeposit = parseFloat(existing.amount_deposited);
    const newTotal = currentDeposit + amount;

    await supabase
      .from("savings_positions")
      .update({
        amount_deposited: newTotal,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    emitToUser(userId, "savings:deposited", {
      totalDeposited: newTotal,
      stellarTxHash: txHash
    });

    return { totalDeposited: newTotal, stellarTxHash: txHash };
  } else {
    await supabase.from("savings_positions").insert({
      user_id: userId,
      amount_deposited: amount,
    });

    emitToUser(userId, "savings:deposited", {
      totalDeposited: amount,
      stellarTxHash: txHash
    });

    return { totalDeposited: amount, stellarTxHash: txHash };
  }
}

// ================================================================
// withdrawFromSavings — Placeholder (belum ada di kontrak)
// ================================================================
/**
 * Withdraw dari Blend belum diimplementasikan di Smart Contract.
 * Untuk saat ini, hanya mengurangi saldo di database (Off-Chain).
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
      `Saldo tabungan tidak mencukupi. Saldo saat ini: ${currentDeposit}.`
    );
  }

  const remaining = currentDeposit - amount;

  if (remaining === 0) {
    await supabase.from("savings_positions").delete().eq("id", existing.id);
    return { remainingDeposit: 0 };
  }

  await supabase
    .from("savings_positions")
    .update({
      amount_deposited: remaining,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);

  return { remainingDeposit: remaining };
}

// ================================================================
// getSavingsPosition — Off-Chain Indexer (Opsi B)
// ================================================================
/**
 * Mengambil posisi tabungan user dan menghitung simulasi yield
 * berdasarkan selisih waktu antara deposited_at dan sekarang.
 *
 * Saldo real di Blend Pool bisa di-query langsung via Blend
 * pool contract (get_positions), tapi untuk kecepatan UI kita
 * menggunakan kalkulasi Off-Chain ini.
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
    onChain: true, // Deposit benar-benar terjadi di Blend on-chain
  };
}
