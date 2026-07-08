import { Keypair } from "@stellar/stellar-sdk";
import { supabase } from "../config/supabase.js";
import { encryptSecretKey } from "../config/stellar.js";

const FRIENDBOT_URL = "https://friendbot.stellar.org";

/**
 * Provision akun Stellar baru untuk user yang baru register.
 *
 * Flow:
 * 1. Cek apakah user sudah punya wallet (idempotent — aman dipanggil berkali-kali)
 * 2. Generate keypair Stellar baru
 * 3. Fund akun via Friendbot (testnet)
 * 4. Enkripsi secret key sebelum disimpan
 * 5. Simpan ke tabel stellar_wallets
 *
 * @param userId - UUID user dari Supabase Auth
 * @returns stellar_public_key milik user
 */
export async function provisionStellarAccount(userId: string): Promise<string> {
  // Cek apakah user sudah punya wallet
  const { data: existing } = await supabase
    .from("stellar_wallets")
    .select("stellar_public_key")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    console.log(`[wallet] User ${userId} sudah punya wallet: ${existing.stellar_public_key}`);
    return existing.stellar_public_key;
  }

  // Generate keypair baru
  const keypair = Keypair.random();
  const publicKey = keypair.publicKey();
  const secretKey = keypair.secret();

  console.log(`[wallet] Provisioning akun Stellar baru untuk user ${userId}...`);

  // Fund via Friendbot (testnet saja)
  const friendbotRes = await fetch(`${FRIENDBOT_URL}?addr=${publicKey}`);
  if (!friendbotRes.ok) {
    const body = await friendbotRes.text();
    throw new Error(`Friendbot gagal: ${friendbotRes.status} — ${body}`);
  }
  console.log(`[wallet] Akun ${publicKey} berhasil di-fund via Friendbot`);

  // --- Tambahkan Trustline untuk TESTUSD & USDC ---
  // Akun Stellar baru secara default hanya bisa memegang XLM.
  // Agar bisa menerima TESTUSD dan USDC, kita harus membuat transaksi 'ChangeTrust'
  console.log(`[wallet] Membuat trustline untuk TESTUSD dan USDC...`);
  const { server, TESTUSD_ASSET, USDC_ASSET, NETWORK_PASSPHRASE } = await import("../config/stellar.js");
  const { TransactionBuilder, Operation, BASE_FEE } = await import("@stellar/stellar-sdk");
  
  const account = await server.loadAccount(publicKey);
  const trustTx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.changeTrust({
        asset: TESTUSD_ASSET,
      })
    )
    .addOperation(
      Operation.changeTrust({
        asset: USDC_ASSET,
      })
    )
    .setTimeout(30)
    .build();

  trustTx.sign(keypair);
  await server.submitTransaction(trustTx);
  console.log(`[wallet] Trustline TESTUSD dan USDC berhasil ditambahkan!`);

  // Enkripsi secret key sebelum simpan ke DB
  const encryptedSecret = await encryptSecretKey(secretKey);

  // Simpan ke database
  const { error } = await supabase.from("stellar_wallets").insert({
    user_id: userId,
    stellar_public_key: publicKey,
    encrypted_secret_key: encryptedSecret,
  });

  if (error) {
    throw new Error(`Gagal menyimpan wallet ke database: ${error.message}`);
  }

  console.log(`[wallet] Wallet berhasil disimpan untuk user ${userId}`);
  return publicKey;
}

/**
 * Ambil wallet (public key) milik user.
 * Tidak pernah return secret key.
 */
export async function getWalletByUserId(
  userId: string
): Promise<{ stellar_public_key: string } | null> {
  const { data, error } = await supabase
    .from("stellar_wallets")
    .select("stellar_public_key")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Gagal fetch wallet: ${error.message}`);
  return data;
}

/**
 * Ambil encrypted secret key untuk keperluan sign transaksi.
 * Fungsi ini hanya dipanggil di payment.service — JANGAN expose ke route/response.
 */
export async function getEncryptedSecretKey(
  userId: string
): Promise<string> {
  const { data, error } = await supabase
    .from("stellar_wallets")
    .select("encrypted_secret_key")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Wallet untuk user ${userId} tidak ditemukan.`);
  }

  return data.encrypted_secret_key;
}
