import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { processOffRamp } from "../services/offramp.service.js";

const router = Router();

// ---------------------------------------------------------------------------
// 1. GET /.well-known/stellar.toml
// ---------------------------------------------------------------------------
// Standar wajib di ekosistem Stellar.
// Setiap "Anchor" (penyedia jasa on/off-ramp) HARUS menyediakan file ini
// di root domain agar wallet lain bisa menemukan dan berinteraksi dengannya.
// Ref: https://developers.stellar.org/docs/tokens/publishing-asset-info
// ---------------------------------------------------------------------------
router.get("/.well-known/stellar.toml", (_req: Request, res: Response) => {
  const issuerKey = process.env.TESTUSD_ISSUER_PUBLIC_KEY ?? "NOT_SET";

  const tomlContent = [
    "# ==========================================================",
    "# Stellar TOML — Kirim Remittance (Hackathon Demo)",
    "# ==========================================================",
    "",
    `ACCOUNTS=["${issuerKey}"]`,
    'VERSION="1.0.0"',
    "",
    "# Lokasi server SEP-24 (penarikan/penyetoran interaktif)",
    `TRANSFER_SERVER_SEP0024="http://localhost:3001/sep24"`,
    "",
    "[[CURRENCIES]]",
    'code="TESTUSD"',
    `issuer="${issuerKey}"`,
    'desc="Token simulasi USD untuk proyek Kirim (Hackathon)"',
    'status="test"',
  ].join("\n");

  // Wajib di-serve sebagai text/plain (bukan JSON/HTML)
  // dan tambahkan header CORS agar wallet dari domain lain bisa mengakses
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.type("text/plain").send(tomlContent);
});

// ---------------------------------------------------------------------------
// 2. POST /sep24/transactions/withdraw/interactive
// ---------------------------------------------------------------------------
// Standar SEP-24: Endpoint ini dipanggil oleh wallet saat user menekan
// tombol "Withdraw" (Tarik Dana). Server mengembalikan URL halaman
// interaktif tempat user mengisi data rekening bank.
//
// Di hackathon ini, kita tidak membangun UI interaktif sungguhan.
// Frontend kita akan menampilkan form-nya sendiri, lalu mengirim
// hasilnya ke POST /api/offramp/submit-bank di bawah.
// ---------------------------------------------------------------------------
router.post(
  "/sep24/transactions/withdraw/interactive",
  authMiddleware,
  (_req: Request, res: Response) => {
    const sessionId = `sep24-${Date.now()}`;

    res.json({
      type: "interactive_customer_info_needed",
      url: `http://localhost:3000/withdraw-form?session=${sessionId}`,
      id: sessionId,
    });
  }
);

// ---------------------------------------------------------------------------
// 3. POST /api/offramp/submit-bank
// ---------------------------------------------------------------------------
// Endpoint custom untuk menerima data rekening bank dari Frontend,
// lalu mengeksekusi pencairan TESTUSD → IDR via Mock Bank API.
//
// Body yang diharapkan:
// {
//   "bankCode": "BCA",
//   "accountNumber": "9876543210",
//   "accountName": "Siti Aminah",
//   "amountTESTUSD": 50
// }
// ---------------------------------------------------------------------------
router.post(
  "/api/offramp/submit-bank",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { bankCode, accountNumber, accountName } = req.body;
      const rawAmount = req.body?.amountTESTUSD;
      const amountTESTUSD = typeof rawAmount === "number" ? rawAmount : parseFloat(rawAmount);

      // Validasi keberadaan field wajib
      if (!bankCode || !accountNumber || !accountName || rawAmount === undefined || rawAmount === null) {
        res.status(400).json({
          error: "Bad Request",
          message:
            "Field bankCode, accountNumber, accountName, dan amountTESTUSD wajib diisi.",
        });
        return;
      }

      // Validasi tipe data amountTESTUSD
      if (isNaN(amountTESTUSD) || amountTESTUSD <= 0) {
        res.status(400).json({
          error: "Bad Request",
          message: "amountTESTUSD harus berupa angka positif.",
        });
        return;
      }

      const userId = req.userId!;

      const result = await processOffRamp(
        userId,
        { bankCode, accountNumber, accountName },
        amountTESTUSD
      );

      res.json({
        message: result.message,
        data: result,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[offramp] Error: ${message}`);

      // Bedakan error validasi (400) vs error server (500)
      const statusCode =
        message.includes("harus") ||
          message.includes("wajib") ||
          message.includes("tidak didukung")
          ? 400
          : 500;

      res.status(statusCode).json({
        error: statusCode === 400 ? "Bad Request" : "Internal Server Error",
        message,
      });
    }
  }
);

export default router;
