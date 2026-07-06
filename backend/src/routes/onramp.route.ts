import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { simulateOnRamp } from "../services/onramp.service.js";

const router = Router();

/**
 * POST /api/onramp/simulate
 *
 * Simulasikan proses On-Ramp: PMI di Malaysia menyetorkan Ringgit (MYR),
 * lalu mendapatkan TESTUSD ke dompet Stellar-nya.
 *
 * Body: { amountMYR: number }
 *
 * Contoh request (curl):
 *   curl -X POST http://localhost:3001/api/onramp/simulate \
 *     -H "Content-Type: application/json" \
 *     -H "Authorization: Bearer <jwt_token>" \
 *     -d '{ "amountMYR": 500 }'
 *
 * Contoh response (sukses):
 *   {
 *     "message": "On-ramp berhasil! 500 MYR → 110.0000000 TESTUSD",
 *     "data": {
 *       "transactionId": "uuid...",
 *       "stellarTxHash": "abc123...",
 *       "amountMYR": 500,
 *       "amountTESTUSD": "110.0000000",
 *       "exchangeRate": 0.22,
 *       "recipientStellarAddress": "GABC..."
 *     }
 *   }
 */
router.post("/simulate", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { amountMYR } = req.body;

    if (!amountMYR || typeof amountMYR !== "number") {
      res.status(400).json({
        error: "Bad Request",
        message: "Field 'amountMYR' wajib diisi dan harus berupa angka.",
      });
      return;
    }

    const userId = req.userId!;
    const result = await simulateOnRamp(userId, amountMYR);

    res.json({
      message: `On-ramp berhasil! ${result.amountMYR} MYR → ${result.amountTESTUSD} TESTUSD`,
      data: result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[onramp] Error: ${message}`);

    // Bedakan antara error validasi (400) dan error server (500)
    const statusCode = message.includes("harus") || message.includes("belum")
      ? 400
      : 500;

    res.status(statusCode).json({
      error: statusCode === 400 ? "Bad Request" : "Internal Server Error",
      message,
    });
  }
});

export default router;
