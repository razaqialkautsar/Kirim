import "dotenv/config";
import { Horizon, Asset, Networks, SorobanRpc, Contract } from "@stellar/stellar-sdk";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const _sodium = require("libsodium-wrappers");

// ---------------------------------------------------------------------------
// Konfigurasi Stellar Network
// ---------------------------------------------------------------------------
const horizonUrl =
  process.env.HORIZON_URL ?? "https://horizon-testnet.stellar.org";
const sorobanRpcUrl =
  process.env.SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org";

// Horizon Server — untuk transaksi Native (On-Ramp, Off-Ramp, dll)
export const server = new Horizon.Server(horizonUrl);

// Soroban RPC Server — untuk transaksi Smart Contract (P2)
export const sorobanServer = new SorobanRpc.Server(sorobanRpcUrl);

export const NETWORK_PASSPHRASE =
  process.env.NETWORK_PASSPHRASE ?? Networks.TESTNET;

// ---------------------------------------------------------------------------
// Smart Contract Kirim (Soroban)
// ---------------------------------------------------------------------------
const contractId = process.env.KIRIM_CONTRACT_ID;
if (!contractId) {
  console.warn(
    "⚠️  KIRIM_CONTRACT_ID belum diisi di .env — fitur Soroban (P2) tidak akan berfungsi."
  );
}
export const kirimContract = contractId ? new Contract(contractId) : null;

// ---------------------------------------------------------------------------
// Blend Pool — USDC Address (untuk fitur Tabungan P1)
// ---------------------------------------------------------------------------
export const BLEND_USDC_ADDRESS =
  process.env.BLEND_USDC_ADDRESS ?? "CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU";

// ---------------------------------------------------------------------------
// Asset TESTUSD
// ---------------------------------------------------------------------------
const testusdIssuerPublicKey = process.env.TESTUSD_ISSUER_PUBLIC_KEY;

if (!testusdIssuerPublicKey) {
  throw new Error("TESTUSD_ISSUER_PUBLIC_KEY harus diisi di file .env");
}

// Asset TESTUSD yang dipakai di seluruh aplikasi
export const TESTUSD_ASSET = new Asset("TESTUSD", testusdIssuerPublicKey);

// ---------------------------------------------------------------------------
// Asset USDC (Circle Testnet)
// ---------------------------------------------------------------------------
// Issuer resmi USDC di Stellar Testnet. Digunakan untuk fitur Tabungan Blend.
export const USDC_ASSET = new Asset(
  "USDC",
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
);

// ---------------------------------------------------------------------------
// Enkripsi / Dekripsi Secret Key Stellar
// Menggunakan libsodium (secretbox) dengan key dari environment variable.
// Secret key Stellar TIDAK PERNAH disimpan dalam bentuk plain text di database.
// ---------------------------------------------------------------------------
const rawEncryptionKey = process.env.STELLAR_SECRET_ENCRYPTION_KEY;

if (!rawEncryptionKey) {
  throw new Error(
    "STELLAR_SECRET_ENCRYPTION_KEY harus diisi di file .env. " +
      "Generate dengan: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
  );
}

// Pastikan libsodium sudah siap sebelum digunakan (async init)
let sodiumReady = false;
const sodiumInitPromise = _sodium.ready.then(() => {
  sodiumReady = true;
});

async function getSodium() {
  if (!sodiumReady) await sodiumInitPromise;
  return _sodium;
}

// Konversi hex string dari .env menjadi Uint8Array 32 byte
function getEncryptionKey(): Uint8Array {
  const hexKey = rawEncryptionKey!;
  if (hexKey.length !== 64) {
    throw new Error(
      "STELLAR_SECRET_ENCRYPTION_KEY harus 64 karakter hex (32 bytes). " +
        `Saat ini panjangnya: ${hexKey.length} karakter.`
    );
  }
  return Uint8Array.from(Buffer.from(hexKey, "hex"));
}

/**
 * Enkripsi secret key Stellar sebelum disimpan ke database.
 * @param plainSecretKey - Secret key Stellar dalam bentuk string biasa (S...)
 * @returns String terenkripsi dalam format "nonce:ciphertext" (hex)
 */
export async function encryptSecretKey(plainSecretKey: string): Promise<string> {
  const sodium = await getSodium();
  const key = getEncryptionKey();
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const message = sodium.from_string(plainSecretKey);
  const ciphertext = sodium.crypto_secretbox_easy(message, nonce, key);

  // Format penyimpanan: "hex(nonce):hex(ciphertext)"
  const nonceHex = Buffer.from(nonce).toString("hex");
  const cipherHex = Buffer.from(ciphertext).toString("hex");
  return `${nonceHex}:${cipherHex}`;
}

/**
 * Dekripsi secret key Stellar dari database untuk digunakan sign transaksi.
 * Hasil dekripsi hanya boleh ada di memory sementara, JANGAN log atau simpan.
 * @param encryptedValue - String dalam format "nonce:ciphertext" (hex)
 * @returns Secret key Stellar dalam bentuk string biasa (S...)
 */
export async function decryptSecretKey(encryptedValue: string): Promise<string> {
  const sodium = await getSodium();
  const key = getEncryptionKey();

  const [nonceHex, cipherHex] = encryptedValue.split(":");
  if (!nonceHex || !cipherHex) {
    throw new Error("Format encrypted_secret_key tidak valid.");
  }

  const nonce = Uint8Array.from(Buffer.from(nonceHex, "hex"));
  const ciphertext = Uint8Array.from(Buffer.from(cipherHex, "hex"));
  const decrypted = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);

  if (!decrypted) {
    throw new Error("Gagal dekripsi secret key — key enkripsi mungkin salah.");
  }

  return sodium.to_string(decrypted);
}
