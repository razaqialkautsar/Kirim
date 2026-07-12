import "dotenv/config";
import { Keypair, TransactionBuilder, Address, BASE_FEE, rpc } from "@stellar/stellar-sdk";
import { sorobanServer, NETWORK_PASSPHRASE, kirimContract } from "../config/stellar.js";

async function run() {
  if (!kirimContract) {
    throw new Error("KIRIM_CONTRACT_ID not set.");
  }
  
  const adminSecret = process.env.TESTUSD_DISTRIBUTOR_SECRET_KEY || process.env.USDC_DEMO_ACCOUNT_SECRET_KEY;
  if (!adminSecret) throw new Error("No admin secret found in .env");
  
  const adminKeypair = Keypair.fromSecret(adminSecret);
  const assetAddress = process.env.TESTUSD_SAC_ADDRESS;
  if (!assetAddress) throw new Error("TESTUSD_SAC_ADDRESS not set.");

  console.log("Initializing contract...");
  console.log("Admin:", adminKeypair.publicKey());
  console.log("Asset:", assetAddress);

  const adminAccount = await sorobanServer.getAccount(adminKeypair.publicKey());

  const adminScVal = new Address(adminKeypair.publicKey()).toScVal();
  const assetScVal = new Address(assetAddress).toScVal();

  const transaction = new TransactionBuilder(adminAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(kirimContract.call("initialize", adminScVal, assetScVal))
    .setTimeout(30)
    .build();

  const simulated = await sorobanServer.simulateTransaction(transaction);
  if (rpc.Api.isSimulationError(simulated)) {
    console.error("Simulation failed", simulated);
    return;
  }

  const preparedTx = rpc.assembleTransaction(transaction, simulated as any).build();
  preparedTx.sign(adminKeypair);

  const sendResult = await sorobanServer.sendTransaction(preparedTx);
  console.log("Tx hash:", sendResult.hash);

  if (sendResult.status !== "PENDING") {
    console.log("Failed to send tx.");
    return;
  }
  
  let status = "PENDING";
  let count = 0;
  while (status === "PENDING" && count < 10) {
    await new Promise(r => setTimeout(r, 2000));
    const tx = await sorobanServer.getTransaction(sendResult.hash);
    status = tx.status;
    console.log("Status:", status);
  }
  console.log("Done.");
}

run().catch(console.error);
