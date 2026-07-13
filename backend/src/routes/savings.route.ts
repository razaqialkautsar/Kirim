import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import {
  depositToSavings,
  withdrawFromSavings,
  getSavingsPosition,
} from "../services/savings.service.js";

const router = Router();

// Semua endpoint tabungan membutuhkan autentikasi
router.use(authMiddleware);

// ================================================================
// GET /api/savings
// Mengambil posisi tabungan + yield saat ini (Off-Chain Indexer)
// ================================================================
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const position = await getSavingsPosition(userId);

    if (!position) {
      res.json({
        message: "Belum ada posisi tabungan.",
        data: null,
      });
      return;
    }

    res.json({
      message: "Posisi tabungan berhasil diambil.",
      data: position,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan.";
    console.error("[GET /savings]", message);
    res.status(500).json({ error: "Internal Server Error", message });
  }
});

// ================================================================
// POST /api/savings/deposit
// Deposit ke Blend on-chain via Soroban, lalu catat ke DB
// Body: { "amount": 100 }
// ================================================================
router.post("/deposit", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const rawAmount = req.body?.amount;
    const amount = parseFloat(rawAmount);

    if (rawAmount === undefined || rawAmount === null || rawAmount === '' || isNaN(amount) || amount <= 0) {
      res.status(400).json({
        error: "Bad Request",
        message: "Field 'amount' harus diisi dan bernilai angka positif.",
      });
      return;
    }

    if (amount < 0.0000001) {
      res.status(400).json({
        error: "Bad Request",
        message: "Jumlah deposit minimal 0.0000001 TESTUSD.",
      });
      return;
    }

    const result = await depositToSavings(userId, amount);
    res.status(201).json({
      message: `Berhasil deposit ${amount} TESTUSD ke Blend on-chain.`,
      data: result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan.";
    console.error("[POST /savings/deposit]", message);
    res.status(500).json({ error: "Internal Server Error", message });
  }
});

// ================================================================
// POST /api/savings/withdraw
// Withdraw dari tabungan (Off-Chain saja untuk saat ini)
// Body: { "amount": 50 }
// ================================================================
router.post("/withdraw", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const rawAmount = req.body?.amount;
    const amount = parseFloat(rawAmount);

    if (rawAmount === undefined || rawAmount === null || rawAmount === '' || isNaN(amount) || amount <= 0) {
      res.status(400).json({
        error: "Bad Request",
        message: "Field 'amount' harus diisi dan bernilai angka positif.",
      });
      return;
    }

    const result = await withdrawFromSavings(userId, amount);
    res.json({
      message: `Berhasil menarik ${amount} TESTUSD dari tabungan.`,
      data: result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan.";
    console.error("[POST /savings/withdraw]", message);
    res.status(500).json({ error: "Internal Server Error", message });
  }
});

export default router;
