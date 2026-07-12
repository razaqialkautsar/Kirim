import "dotenv/config";
import { Keypair, TransactionBuilder, Operation, BASE_FEE, Asset } from "@stellar/stellar-sdk";
import { supabase } from "../config/supabase.js";
import { server, NETWORK_PASSPHRASE, decryptSecretKey } from "../config/stellar.js";

const BLEND_USDC_ASSET = new Asset("USDC", "GATALTGTWIOT6BUDBCZM3Q4OQ4BO2COLOAZ7IYSKPLC2PMSOPPGF5V56");

async function run() {
  const { data: wallets, error } = await supabase.from("stellar_wallets").select("*");
  if (error || !wallets) {
    console.error("Failed to fetch wallets", error);
    return;
  }

  console.log(`Found ${wallets.length} wallets. Adding USDC trustlines...`);

  for (const wallet of wallets) {
    try {
      const plainSecret = await decryptSecretKey(wallet.encrypted_secret_key);
      const keypair = Keypair.fromSecret(plainSecret);
      
      const account = await server.loadAccount(keypair.publicKey());
      
      const hasTrustline = account.balances.some(
        (b) => b.asset_code === BLEND_USDC_ASSET.code && b.asset_issuer === BLEND_USDC_ASSET.issuer
      );

      if (hasTrustline) {
        console.log(`Account ${keypair.publicKey()} already has USDC trustline.`);
        continue;
      }

      console.log(`Adding USDC trustline for ${keypair.publicKey()}...`);
      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          Operation.changeTrust({
            asset: BLEND_USDC_ASSET,
          })
        )
        .setTimeout(30)
        .build();

      tx.sign(keypair);
      await server.submitTransaction(tx);
      console.log(`Successfully added USDC trustline for ${keypair.publicKey()}`);
    } catch (e: any) {
      console.error(`Failed for ${wallet.stellar_public_key}:`, e?.message || e);
    }
  }
}

run();
