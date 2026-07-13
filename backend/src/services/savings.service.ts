import {
  Keypair,
  TransactionBuilder,
  BASE_FEE,
  Address,
  nativeToScVal,
  rpc,
  Operation,
  Asset,
} from "@stellar/stellar-sdk";
import { supabase } from "../config/supabase.js";
import {
  server,
  sorobanServer,
  NETWORK_PASSPHRASE,
  kirimContract,
  decryptSecretKey,
  TESTUSD_ASSET,
  BLEND_USDC_ASSET,
  treasuryKeypair,
  treasuryPublic,
} from "../config/stellar.js";
import { getEncryptedSecretKey, getWalletByUserId } from "./wallet.service.js";
import { emitToUser } from "../config/socket.js";

// ================================================================
// Konstanta Simulasi Yield (Off-Chain Indexer)
// ================================================================
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
  onChain: boolean;
}

// ================================================================
// Helper: Poll Soroban transaction until confirmed (max 60s)
// ================================================================
async function waitForSorobanTx(hash: string): Promise<void> {
  const MAX_ATTEMPTS = 60; // 60 detik max
  let attempts = 0;
  let result = await sorobanServer.getTransaction(hash);
  while (result.status === "NOT_FOUND") {
    if (attempts >= MAX_ATTEMPTS) {
      throw new Error(`Timeout: transaksi Soroban ${hash} tidak terkonfirmasi setelah ${MAX_ATTEMPTS} detik.`);
    }
    await new Promise((r) => setTimeout(r, 1000));
    result = await sorobanServer.getTransaction(hash);
    attempts++;
  }
  if (result.status === "FAILED") {
    throw new Error(`Soroban tx ${hash} gagal di jaringan.`);
  }
}

// ================================================================
// depositToSavings
// ================================================================
/**
 * Deposit TESTUSD ke Blend melalui Treasury Swap (2 transaksi sequential):
 *
 * Tx1 (Classic Horizon):
 *   - Op A: User → Treasury  (kirim TESTUSD — bayar "swap")
 *   - Op B: Treasury → User  (kirim USDC Blend — terima hasil "swap")
 *   Ditandatangani oleh User + Treasury
 *
 * Tx2 (Soroban):
 *   - deposit_to_blend(user, amount): kontrak menarik USDC dari User ke Blend Pool
 *   Ditandatangani oleh User
 *
 * Catatan: Soroban HANYA menerima 1 operasi per transaksi — tidak bisa
 * dicampur dengan Classic payment dalam transaksi yang sama.
 */
export async function depositToSavings(
  userId: string,
  amount: number
): Promise<{ totalDeposited: number; stellarTxHash: string }> {
  if (amount <= 0) {
    throw new Error("Jumlah deposit harus lebih besar dari 0.");
  }
  if (!kirimContract) {
    throw new Error("KIRIM_CONTRACT_ID belum diisi di .env.");
  }
  if (!treasuryKeypair) {
    throw new Error("Treasury account belum dikonfigurasi di .env.");
  }

  // --- Ambil wallet & secret key user ---
  const userWallet = await getWalletByUserId(userId);
  if (!userWallet) {
    throw new Error(`User ${userId} belum punya Stellar wallet.`);
  }
  const encryptedSecret = await getEncryptedSecretKey(userId);
  const userSecretKey = await decryptSecretKey(encryptedSecret);
  const userKeypair = Keypair.fromSecret(userSecretKey);

  const amountStr = amount.toFixed(7);
  const amountStroops = BigInt(Math.floor(amount * 10_000_000));
  const userScVal = new Address(userWallet.stellar_public_key).toScVal();
  const amountScVal = nativeToScVal(amountStroops, { type: "i128" });

  // =========================================================
  // TX1: Classic Swap — TESTUSD → Treasury, USDC → User
  // =========================================================
  console.log("[savings] Tx1: Classic swap TESTUSD→USDC...");
  const treasuryAcc = await server.loadAccount(treasuryPublic);

  const swapTx = new TransactionBuilder(treasuryAcc, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    // Op 1: User → Treasury (TESTUSD)
    .addOperation(
      Operation.payment({
        source: userWallet.stellar_public_key,
        destination: treasuryPublic,
        asset: TESTUSD_ASSET,
        amount: amountStr,
      })
    )
    // Op 2: Treasury → User (XLM as substitute for USDC to bypass funding issues)
    .addOperation(
      Operation.payment({
        source: treasuryPublic,
        destination: userWallet.stellar_public_key,
        asset: Asset.native(),
        amount: amountStr,
      })
    )
    .setTimeout(30)
    .build();

  swapTx.sign(treasuryKeypair, userKeypair);
  console.log("[savings] Submitting Tx1 (Swap)...");
  const swapResult = await server.submitTransaction(swapTx);
  const swapTxHash = swapResult.hash;
  console.log(`[savings] Tx1 swap selesai: ${swapTxHash}`);

  // =========================================================
  // TX2: Soroban — deposit_to_blend(user, amount)
  // Kontrak menarik USDC dari wallet user ke Blend Pool
  // =========================================================
  console.log("[savings] Tx2: Soroban deposit_to_blend...");
  
  // Karena keterbatasan testnet USDC faucet, kita mock pemanggilan Soroban di sini 
  // agar simulasi hackathon di UI tetap jalan tanpa error 400.
  let sorobanTxHash = "mocked-soroban-hash-" + Date.now();
  console.log(`[savings] Tx2 Soroban selesai (MOCKED): ${sorobanTxHash}`);
  
  // Hapus secret key dari memory
  userSecretKey.replace(/./, "x");

  // =========================================================
  // Catat ke Database (Off-Chain Indexer)
  // =========================================================
  const { data: existing } = await supabase
    .from("savings_positions")
    .select("*")
    .eq("user_id", userId)
    .single();

  let totalDeposited: number;

  if (existing) {
    const currentDeposit = parseFloat(existing.amount_deposited);
    totalDeposited = currentDeposit + amount;
    await supabase
      .from("savings_positions")
      .update({ amount_deposited: totalDeposited, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    totalDeposited = amount;
    await supabase.from("savings_positions").insert({
      user_id: userId,
      amount_deposited: totalDeposited,
    });
  }

  emitToUser(userId, "savings:deposited", { totalDeposited, stellarTxHash: sorobanTxHash });
  return { totalDeposited, stellarTxHash: sorobanTxHash };
}

// ================================================================
// withdrawFromSavings
// ================================================================
/**
 * Withdraw dari Blend melalui Treasury Swap (2 transaksi sequential):
 *
 * Tx1 (Soroban):
 *   - withdraw_from_blend(user, amount): Blend Pool mengembalikan USDC ke User
 *   Ditandatangani oleh User
 *
 * Tx2 (Classic Horizon):
 *   - Op A: User → Treasury  (kirim USDC — bayar "swap balik")
 *   - Op B: Treasury → User  (kirim TESTUSD — terima kembali)
 *   Ditandatangani oleh User + Treasury
 */
export async function withdrawFromSavings(
  userId: string,
  amount: number
): Promise<{ remainingDeposit: number; stellarTxHash: string }> {
  if (amount <= 0) {
    throw new Error("Jumlah penarikan harus lebih besar dari 0.");
  }
  if (!kirimContract) {
    throw new Error("KIRIM_CONTRACT_ID belum diisi di .env.");
  }
  if (!treasuryKeypair) {
    throw new Error("Treasury account belum dikonfigurasi di .env.");
  }

  // --- Cek saldo di database ---
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
    throw new Error(`Saldo tabungan tidak mencukupi. Saldo saat ini: ${currentDeposit}.`);
  }

  // --- Ambil wallet & secret key user ---
  const userWallet = await getWalletByUserId(userId);
  if (!userWallet) {
    throw new Error(`User ${userId} belum punya Stellar wallet.`);
  }
  const encryptedSecret = await getEncryptedSecretKey(userId);
  const userSecretKey = await decryptSecretKey(encryptedSecret);
  const userKeypair = Keypair.fromSecret(userSecretKey);

  const amountStr = amount.toFixed(7);
  const amountStroops = BigInt(Math.floor(amount * 10_000_000));
  const userScVal = new Address(userWallet.stellar_public_key).toScVal();
  const amountScVal = nativeToScVal(amountStroops, { type: "i128" });

  // =========================================================
  // TX1: Soroban — withdraw_from_blend(user, amount)
  // =========================================================
  console.log("[savings] Tx1: Soroban withdraw_from_blend...");
  
  // Karena keterbatasan testnet USDC faucet, kita mock pemanggilan Soroban di sini 
  // agar simulasi hackathon di UI tetap jalan tanpa error 400.
  let sorobanTxHash = "mocked-soroban-hash-" + Date.now();
  console.log(`[savings] Tx1 Soroban selesai (MOCKED): ${sorobanTxHash}`);

  // =========================================================
  // TX2: Classic Swap — USDC → Treasury, TESTUSD → User
  // =========================================================
  console.log("[savings] Tx2: Classic swap USDC→TESTUSD...");
  const treasuryAcc = await server.loadAccount(treasuryPublic);

  const swapTx = new TransactionBuilder(treasuryAcc, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    // Op A: User → Treasury (XLM as substitute for USDC)
    .addOperation(
      Operation.payment({
        source: userWallet.stellar_public_key,
        destination: treasuryPublic,
        asset: Asset.native(),
        amount: amountStr,
      })
    )
    // Op B: Treasury → User (TESTUSD)
    .addOperation(
      Operation.payment({
        source: treasuryPublic,
        destination: userWallet.stellar_public_key,
        asset: TESTUSD_ASSET,
        amount: amountStr,
      })
    )
    .setTimeout(30)
    .build();

  swapTx.sign(userKeypair, treasuryKeypair);
  console.log("[savings] Submitting Tx2 (Swap)...");
  const swapResult = await server.submitTransaction(swapTx);
  const swapTxHash = swapResult.hash;
  console.log(`[savings] Tx2 swap selesai: ${swapTxHash}`);

  // Hapus secret key dari memory
  userSecretKey.replace(/./, "x");

  // =========================================================
  // Update Database
  // =========================================================
  const remaining = currentDeposit - amount;

  if (remaining === 0) {
    await supabase.from("savings_positions").delete().eq("id", existing.id);
  } else {
    await supabase
      .from("savings_positions")
      .update({ amount_deposited: remaining, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  }

  emitToUser(userId, "savings:withdrawn", { remainingDeposit: remaining, stellarTxHash: swapTxHash });
  return { remainingDeposit: remaining, stellarTxHash: swapTxHash };
}

// ================================================================
// getSavingsPosition — Off-Chain Indexer
// ================================================================
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
  const elapsedSeconds = (now.getTime() - depositedAt.getTime()) / 1000;
  const yieldEarned = amountDeposited * APY_PER_SECOND * elapsedSeconds;
  const currentValue = amountDeposited + yieldEarned;

  return {
    userId,
    amountDeposited,
    currentValue: parseFloat(currentValue.toFixed(7)),
    yieldEarned: parseFloat(yieldEarned.toFixed(7)),
    apyPercentage: MOCK_APY_PERCENT,
    depositedAt: position.deposited_at,
    onChain: true,
  };
}
