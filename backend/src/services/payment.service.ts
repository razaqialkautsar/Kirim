import {
  Keypair,
  TransactionBuilder,
  BASE_FEE,
  xdr,
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

export interface RecipientInput {
  stellarAddress: string; // Stellar public key penerima (G...)
  percentageBps: number;  // Basis points: 6000 = 60.00%
}

export interface SendPaymentResult {
  transactionId: string;
  stellarTxHash: string;
  status: string;
}

// ---------------------------------------------------------------------------
// Helper: Konversi RecipientInput[] → Vec<RecipientShare> dalam format ScVal
// Sesuai dengan struct RecipientShare di contracts/src/types.rs:
//   { recipient: Address, percentage: u32, amount: i128 }
// ---------------------------------------------------------------------------
function buildRecipientsScVal(
  recipients: RecipientInput[],
  totalAmountStroops: bigint
): xdr.ScVal {
  const totalBps = BigInt(10000);
  const shares = recipients.map((r) => {
    const amount = (totalAmountStroops * BigInt(r.percentageBps)) / totalBps;

    return xdr.ScVal.scvMap([
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol("amount"),
        val: nativeToScVal(amount, { type: "i128" }),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol("percentage"),
        val: nativeToScVal(r.percentageBps, { type: "u32" }),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol("recipient"),
        val: new Address(r.stellarAddress).toScVal(),
      }),
    ]);
  });

  return xdr.ScVal.scvVec(shares);
}

/**
 * Kirim TESTUSD dari sender ke beberapa penerima sekaligus
 * menggunakan Smart Contract Soroban (P2).
 *
 * Memanggil fungsi `create_and_execute_disbursement` pada kontrak Kirim
 * yang sudah di-deploy oleh Tim Smart Contract.
 *
 * @param senderId - UUID user pengirim (dari Supabase Auth)
 * @param recipients - Array penerima dan persentase masing-masing
 * @param totalAmountTestusd - Total TESTUSD yang dikirim (contoh: "100")
 */
export async function sendSplitPayment(
  senderId: string,
  recipients: RecipientInput[],
  totalAmountTestusd: string
): Promise<SendPaymentResult> {
  // --- Prasyarat: Kontrak harus sudah dikonfigurasi ---
  if (!kirimContract) {
    throw new Error(
      "KIRIM_CONTRACT_ID belum diisi di .env. Fitur Soroban (P2) tidak aktif."
    );
  }

  // --- Validasi input ---
  if (recipients.length < 1 || recipients.length > 5) {
    throw new Error("Jumlah penerima harus antara 1 sampai 5.");
  }

  const totalBps = recipients.reduce((sum, r) => sum + r.percentageBps, 0);
  if (totalBps !== 10000) {
    throw new Error(
      `Total persentase harus tepat 10000 basis points (100%). Saat ini: ${totalBps} bps.`
    );
  }

  const totalAmount = parseFloat(totalAmountTestusd);
  if (isNaN(totalAmount) || totalAmount <= 0) {
    throw new Error("totalAmountTestusd harus angka positif.");
  }

  // --- Ambil wallet sender ---
  const senderWallet = await getWalletByUserId(senderId);
  if (!senderWallet) {
    throw new Error(
      `User ${senderId} belum punya Stellar wallet. Jalankan /api/wallets/provision dulu.`
    );
  }

  // --- Hitung amount per penerima (untuk disimpan di DB) ---
  const recipientAmounts = recipients.map((r) => ({
    address: r.stellarAddress,
    amount: ((totalAmount * r.percentageBps) / 10000).toFixed(7),
  }));

  // --- Buat record transaksi awal di database (status: pending) ---
  const { data: txRecord, error: txInsertError } = await supabase
    .from("transactions")
    .insert({
      sender_id: senderId,
      total_amount: totalAmount,
      status: "pending",
    })
    .select("id")
    .single();

  if (txInsertError || !txRecord) {
    throw new Error(
      `Gagal membuat record transaksi: ${txInsertError?.message}`
    );
  }

  const transactionId = txRecord.id;

  // Simpan detail penerima
  await supabase.from("transaction_recipients").insert(
    recipientAmounts.map((r, i) => ({
      transaction_id: transactionId,
      receiver_stellar_address: r.address,
      percentage_bps: recipients[i].percentageBps,
      amount: parseFloat(r.amount),
    }))
  );

  // --- Build transaksi Soroban ---
  // Decrypt secret key hanya di memory (JANGAN pernah log nilai ini)
  const encryptedSecret = await getEncryptedSecretKey(senderId);
  const senderSecretKey = await decryptSecretKey(encryptedSecret);
  const senderKeypair = Keypair.fromSecret(senderSecretKey);

  // Load akun sender dari Soroban RPC (untuk sequence number)
  const senderAccount = await sorobanServer.getAccount(
    senderWallet.stellar_public_key
  );

  // Build parameter pemanggilan Smart Contract
  // Konversi total amount ke stroops (7 desimal) sebagai i128
  const totalAmountStroops = BigInt(Math.floor(totalAmount * 10_000_000));
  const senderScVal = new Address(senderWallet.stellar_public_key).toScVal();
  const totalAmountScVal = nativeToScVal(totalAmountStroops, { type: "i128" });
  const recipientsScVal = buildRecipientsScVal(recipients, totalAmountStroops);

  // Rakit transaksi invokeHostFunction
  const transaction = new TransactionBuilder(senderAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      kirimContract.call(
        "create_and_execute_disbursement",
        senderScVal,
        totalAmountScVal,
        recipientsScVal
      )
    )
    .setTimeout(30)
    .build();

  // --- Simulasi dulu (WAJIB untuk Soroban) ---
  const simResult = await sorobanServer.simulateTransaction(transaction);

  if (rpc.Api.isSimulationError(simResult)) {
    const reason =
      "error" in simResult ? String(simResult.error) : "Simulasi gagal";
    await supabase
      .from("transactions")
      .update({ status: "failed", failure_reason: reason })
      .eq("id", transactionId);
    throw new Error(`Simulasi Soroban gagal: ${reason}`);
  }

  // Gabungkan hasil simulasi (resource fee, auth) ke transaksi asli
  const preparedTx = rpc.assembleTransaction(
    transaction,
    simResult as any
  ).build();

  // Sign transaksi
  preparedTx.sign(senderKeypair);

  // Hapus secret key dari memory secepat mungkin
  senderSecretKey.replace(/./, "x");

  // Update status ke 'submitted' sebelum submit ke jaringan
  await supabase
    .from("transactions")
    .update({ status: "submitted" })
    .eq("id", transactionId);

  // --- Submit ke Soroban RPC ---
  let txHash: string;
  try {
    const sendResult = await sorobanServer.sendTransaction(preparedTx);
    txHash = sendResult.hash;

    // Polling status sampai transaksi terkonfirmasi
    let getResult = await sorobanServer.getTransaction(txHash);
    while (getResult.status === "NOT_FOUND") {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      getResult = await sorobanServer.getTransaction(txHash);
    }

    if (getResult.status === "FAILED") {
      throw new Error("Transaksi Soroban gagal di jaringan (status: FAILED)");
    }

    console.log(`[payment/soroban] Transaksi sukses: ${txHash}`);
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : String(err);
    await supabase
      .from("transactions")
      .update({ status: "failed", failure_reason: reason })
      .eq("id", transactionId);
    throw new Error(`Submit transaksi Soroban gagal: ${reason}`);
  }

  // Update record transaksi
  const { error: updateError } = await supabase
    .from("transactions")
    .update({
      status: "completed",
      stellar_tx_hash: txHash,
      completed_at: new Date().toISOString(),
    })
    .eq("id", transactionId);

  if (updateError) {
    console.error(`[payment] Gagal update status transaksi di DB: ${updateError.message}`);
  }

  // --- Kirim notifikasi WebSocket ke Pengirim ---
  emitToUser(senderId, "transaction:completed", {
    transactionId,
    stellarTxHash: txHash,
    totalAmount,
    recipients
  });

  // --- Kirim notifikasi WebSocket ke masing-masing Penerima ---
  for (const r of recipientAmounts) {
    const { data: walletData } = await supabase
      .from("stellar_wallets")
      .select("user_id")
      .eq("stellar_public_key", r.address)
      .maybeSingle();

    if (walletData?.user_id) {
      emitToUser(walletData.user_id, "transaction:received", {
        transactionId,
        stellarTxHash: txHash,
        amount: parseFloat(r.amount),
        from: senderId
      });
    }
  }

  return {
    transactionId,
    stellarTxHash: txHash,
    status: "completed",
  };
}

/**
 * Ambil status transaksi dari database.
 */
export async function getTransactionStatus(transactionId: string) {
  const { data, error } = await supabase
    .from("transactions")
    .select(`
      id,
      status,
      stellar_tx_hash,
      total_amount,
      failure_reason,
      created_at,
      completed_at,
      transaction_recipients (
        receiver_stellar_address,
        percentage_bps,
        amount
      )
    `)
    .eq("id", transactionId)
    .single();

  if (error || !data) {
    throw new Error(`Transaksi ${transactionId} tidak ditemukan.`);
  }

  return data;
}
