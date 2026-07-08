import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import {
  sendSplitPayment,
  getTransactionStatus,
  RecipientInput,
} from "../services/payment.service.js";

const router = Router();

/**
 * POST /api/transactions/send
 *
 * Kirim TESTUSD dari user yang login ke beberapa penerima sekaligus.
 *
 * Body:
 * {
 *   "recipients": [
 *     { "stellarAddress": "GDMY27V...", "percentageBps": 6000 },
 *     { "stellarAddress": "GAWPRAL...", "percentageBps": 3000 },
 *     { "stellarAddress": "GBTZY5H...", "percentageBps": 1000 }
 *   ],
 *   "totalAmountTestusd": "100"
 * }
 *
 * Constraint:
 * - Total percentageBps harus tepat 10000 (100%)
 * - Jumlah penerima: 1-5
 */
router.post("/send", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { recipients, totalAmountTestusd } = req.body as {
      recipients: RecipientInput[];
      totalAmountTestusd: string;
    };

    // Validasi field wajib ada
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      res.status(400).json({
        error: "Bad Request",
        message: "Field 'recipients' harus array dengan minimal 1 elemen.",
      });
      return;
    }

    if (!totalAmountTestusd) {
      res.status(400).json({
        error: "Bad Request",
        message: "Field 'totalAmountTestusd' harus diisi (string angka, contoh: \"100\").",
      });
      return;
    }

    // Validasi struktur tiap recipient
    for (const r of recipients) {
      if (!r.stellarAddress || typeof r.percentageBps !== "number") {
        res.status(400).json({
          error: "Bad Request",
          message: "Setiap recipient harus punya 'stellarAddress' (string) dan 'percentageBps' (number).",
        });
        return;
      }
    }

    const result = await sendSplitPayment(userId, recipients, totalAmountTestusd);

    res.status(201).json({
      message: "Transaksi berhasil dikirim.",
      ...result,
      explorerUrl: `https://stellar.expert/explorer/testnet/tx/${result.stellarTxHash}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan tidak terduga.";
    console.error("[POST /transactions/send]", message);

    // Bedakan error validasi vs error server
    const isValidationError =
      message.includes("basis points") ||
      message.includes("penerima") ||
      message.includes("positif");

    res.status(isValidationError ? 400 : 500).json({
      error: isValidationError ? "Bad Request" : "Internal Server Error",
      message,
    });
  }
});

/**
 * GET /api/transactions/:id/status
 * Cek status dan detail transaksi berdasarkan UUID transaksi.
 */
router.get("/:id/status", authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const data = await getTransactionStatus(id);

    res.json({
      ...data,
      explorerUrl: data.stellar_tx_hash
        ? `https://stellar.expert/explorer/testnet/tx/${data.stellar_tx_hash}`
        : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan tidak terduga.";
    console.error("[GET /transactions/:id/status]", message);

    const isNotFound = message.includes("tidak ditemukan");
    res.status(isNotFound ? 404 : 500).json({
      error: isNotFound ? "Not Found" : "Internal Server Error",
      message,
    });
  }
});

export default router;
