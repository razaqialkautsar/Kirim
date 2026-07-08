import "dotenv/config";
import express from "express";
import http from "http";
import { initSocket } from "./config/socket.js";
import { socketAuthMiddleware } from "./middleware/socket-auth.middleware.js";
import walletRouter from "./routes/wallet.route.js";
import transactionRouter from "./routes/transaction.route.js";
import onrampRouter from "./routes/onramp.route.js";
import sep24Router from "./routes/sep24.route.js";
import dashboardRouter from "./routes/dashboard.route.js";
import savingsRouter from "./routes/savings.route.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(express.json()); // Parse request body JSON

// CORS sederhana untuk development — Frontend (localhost:3000) boleh akses
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (_req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/wallets", walletRouter);
app.use("/api/transactions", transactionRouter);
app.use("/api/onramp", onrampRouter);
app.use("/", sep24Router); // /.well-known/stellar.toml, /sep24/*, /api/offramp/*
app.use("/api/dashboard", dashboardRouter);
app.use("/api/savings", savingsRouter);

// Handler untuk route yang tidak ditemukan
app.use((_req, res) => {
  res.status(404).json({ error: "Not Found", message: "Endpoint tidak ditemukan." });
});

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------
const httpServer = http.createServer(app);

// Inisialisasi Socket.io dan attach middleware autentikasi
const io = initSocket(httpServer);
io.use(socketAuthMiddleware);

httpServer.listen(PORT, () => {
  console.log(`\n🚀 Kirim Backend berjalan di http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   Wallets:      http://localhost:${PORT}/api/wallets`);
  console.log(`   Transactions: http://localhost:${PORT}/api/transactions`);
  console.log(`   On-Ramp:      http://localhost:${PORT}/api/onramp`);
  console.log(`   Off-Ramp:     http://localhost:${PORT}/api/offramp/submit-bank`);
  console.log(`   Dashboard:    http://localhost:${PORT}/api/dashboard`);
  console.log(`   Savings:      http://localhost:${PORT}/api/savings`);
  console.log(`   Stellar TOML: http://localhost:${PORT}/.well-known/stellar.toml`);
  console.log(`   WebSocket:    ws://localhost:${PORT}\n`);
});
