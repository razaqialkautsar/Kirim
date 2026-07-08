import { createClient } from "@supabase/supabase-js";
import { io } from "socket.io-client";
import "dotenv/config";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Bisa pakai anon/service key untuk script

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const email = `test-${Date.now()}@example.com`;
  const password = "password123";

  console.log(`[1/4] Create user: ${email}...`);
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({ 
    email, 
    password,
    email_confirm: true
  });
  if (authError) throw authError;

  // Login untuk dapat session token
  const { data: loginData } = await supabase.auth.signInWithPassword({ email, password });
  const token = loginData.session?.access_token;
  if (!token) throw new Error("No token returned");

  console.log(`[2/4] Provisioning wallet... (ini butuh waktu karena manggil Friendbot)`);
  const resProv = await fetch("http://localhost:3001/api/wallets/provision", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (!resProv.ok) {
    throw new Error(`Provision failed: ${await resProv.text()}`);
  }
  const provData = await resProv.json();
  console.log(`      Wallet sukses: ${provData.stellar_public_key}`);

  console.log("[3/4] Connecting WebSocket...");
  const socket = io("http://localhost:3001", {
    auth: { token }
  });

  socket.on("connect", () => {
    console.log("      ✅ WebSocket terhubung ke server!");
  });

  // Dengarkan event
  socket.on("onramp:completed", (data) => {
    console.log("\n🎉 [MOCK FRONTEND] MENERIMA WEBSOCKET EVENT 'onramp:completed'!");
    console.log("Data Payload:", JSON.stringify(data, null, 2));
    
    // Sukses, matikan script
    socket.disconnect();
    process.exit(0);
  });

  // Beri waktu 2 detik agar WebSocket benar-benar terhubung
  await new Promise(r => setTimeout(r, 2000));

  console.log("[4/4] Triggering POST /api/onramp/simulate (100 MYR)...");
  const resOnramp = await fetch("http://localhost:3001/api/onramp/simulate", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amountMYR: 100 })
  });
  
  if (!resOnramp.ok) {
      console.error("Gagal onramp:", await resOnramp.text());
  } else {
      console.log("      Request API selesai, menunggu notifikasi WebSocket balik...");
  }
}

main().catch(console.error);
