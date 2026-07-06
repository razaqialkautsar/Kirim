/**
 * Bikin akun dummy (sender & receiver) buat testing transfer/split
 * disbursement, lengkap dengan:
 *   1. Fund XLM via Friendbot (buat bayar network fee)
 *   2. Trustline ke TESTUSD
 *   3. Saldo awal TESTUSD (dikirim dari distributor)
 *
 * PRASYARAT: sudah jalanin `npm run setup:testusd` dulu, dan sudah isi
 * TESTUSD_DISTRIBUTOR_PUBLIC_KEY & TESTUSD_DISTRIBUTOR_SECRET_KEY di .env
 *
 * Jalankan: npm run setup:test-accounts
 */

import { Keypair, Asset, TransactionBuilder, Operation, BASE_FEE } from "@stellar/stellar-sdk";
import { server, fundWithFriendbot, NETWORK_PASSPHRASE, sleep } from "./config.js";

const DISTRIBUTOR_SECRET = process.env.TESTUSD_DISTRIBUTOR_SECRET_KEY;
const ISSUER_PUBLIC_KEY = process.env.TESTUSD_ISSUER_PUBLIC_KEY;

// Berapa banyak akun dummy yang mau dibuat, dan berapa saldo awal per akun.
// Sesuaikan dengan kebutuhan test case (misal 3 recipient buat test split 60/30/10).
const ACCOUNTS_TO_CREATE = [
  { label: "sender", initialTESTUSD: "5000" },
  { label: "receiver-1", initialTESTUSD: "100" },
  { label: "receiver-2", initialTESTUSD: "100" },
  { label: "receiver-3", initialTESTUSD: "100" },
  { label: "receiver-4", initialTESTUSD: "100" },
  { label: "receiver-5", initialTESTUSD: "100" },
];

async function main() {
  if (!DISTRIBUTOR_SECRET || !ISSUER_PUBLIC_KEY) {
    console.error(
      "TESTUSD_DISTRIBUTOR_SECRET_KEY atau TESTUSD_ISSUER_PUBLIC_KEY belum diisi di .env.",
    );
    console.error("Jalankan `npm run setup:testusd` dulu, lalu isi .env dari output-nya.");
    process.exit(1);
  }

  const distributor = Keypair.fromSecret(DISTRIBUTOR_SECRET);
  const testUSD = new Asset("TESTUSD", ISSUER_PUBLIC_KEY);

  console.log("=== Bikin Akun Dummy buat Testing ===\n");

  const createdAccounts: { label: string; publicKey: string; secretKey: string }[] = [];

  for (const { label, initialTESTUSD } of ACCOUNTS_TO_CREATE) {
    console.log(`--- ${label} ---`);
    const account = Keypair.random();

    // 1. Fund XLM via Friendbot
    await fundWithFriendbot(account.publicKey());
    await sleep(1000);

    // 2. Trustline ke TESTUSD
    const loadedAccount = await server.loadAccount(account.publicKey());
    const trustTx = new TransactionBuilder(loadedAccount, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(Operation.changeTrust({ asset: testUSD, limit: "1000000" }))
      .setTimeout(30)
      .build();
    trustTx.sign(account);
    await server.submitTransaction(trustTx);
    console.log(`  Trustline TESTUSD dibuat`);

    // 3. Kirim saldo awal TESTUSD dari distributor
    const distributorAccount = await server.loadAccount(distributor.publicKey());
    const fundTx = new TransactionBuilder(distributorAccount, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.payment({
          destination: account.publicKey(),
          asset: testUSD,
          amount: initialTESTUSD,
        }),
      )
      .setTimeout(30)
      .build();
    fundTx.sign(distributor);
    await server.submitTransaction(fundTx);
    console.log(`  Dikirim ${initialTESTUSD} TESTUSD dari distributor`);
    console.log(`  Public key: ${account.publicKey()}\n`);

    createdAccounts.push({
      label,
      publicKey: account.publicKey(),
      secretKey: account.secret(),
    });

    await sleep(1000); // jeda kecil antar akun biar gak kena rate limit
  }

  console.log("=== SELESAI — daftar akun dummy ===\n");
  for (const acc of createdAccounts) {
    console.log(`${acc.label.toUpperCase()}_PUBLIC_KEY=${acc.publicKey}`);
    console.log(`${acc.label.toUpperCase()}_SECRET_KEY=${acc.secretKey}`);
  }
  console.log(
    "\n>> Simpan daftar ini di tempat aman (misal file .env.testaccounts terpisah).",
  );
  console.log(
    ">> Public key ini yang dipakai sebagai `sender`/`recipients` saat testing create_disbursement.",
  );
}

main().catch((err) => {
  console.error("Gagal bikin akun dummy:", err);
  process.exit(1);
});
