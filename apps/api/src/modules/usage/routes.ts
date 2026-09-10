import { Router } from "express";
import { env } from "../../config/env.js";
import { requireAuth, userId } from "../../middleware/auth.js";
import { UsageDaily } from "../../models/usage-daily.js";

const router = Router();
router.use(requireAuth);
router.get("/usage", async (req, res) => {
  const dateKey = new Date().toISOString().slice(0, 10);
  const usage = await UsageDaily.findOne({ userId: userId(req), dateKey }).lean();
  const used = Math.max(0, usage?.pointsUsed ?? 0);
  return res.json({
    data: {
      dateKey,
      limit: env.DAILY_POINTS_LIMIT,
      used,
      remaining: Math.max(0, env.DAILY_POINTS_LIMIT - used)
    },
    meta: { requestId: null }
  });
});
export default router;
