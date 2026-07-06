import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { getDashboardData } from "../services/dashboard.service.js";

const router = Router();

/**
 * GET /api/dashboard
 *
 * Endpoint utama untuk halaman beranda (Home) di Frontend.
 * Mengembalikan seluruh data yang dibutuhkan untuk menampilkan:
 * - Alamat dompet Stellar
 * - Ringkasan metrik (total transaksi, penghematan biaya, dll)
 * - Riwayat transaksi terbaru (on-ramp, disbursement, off-ramp)
 *
 * Autentikasi: JWT Token (userId otomatis terdeteksi dari token)
 *
 * Contoh request (curl):
 *   curl http://localhost:3001/api/dashboard \
 *     -H "Authorization: Bearer <jwt_token>"
 *
 * Contoh response (sukses):
 *   {
 *     "data": {
 *       "wallet": { "stellarAddress": "GABC..." },
 *       "metrics": {
 *         "totalTransactions": 5,
 *         "totalOnRampMYR": 2000,
 *         "totalDisbursedUSD": 440,
 *         "totalOffRampIDR": 3300000,
 *         "totalSavedUSD": 21.12,
 *         "traditionalFeePercent": 4.8,
 *         "kirimFeePercent": 0
 *       },
 *       "history": [ ... ]
 *     }
 *   }
 */
router.get("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const dashboardData = await getDashboardData(userId);

    res.json({ data: dashboardData });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[dashboard] Error: ${message}`);
    res.status(500).json({
      error: "Internal Server Error",
      message,
    });
  }
});

export default router;
