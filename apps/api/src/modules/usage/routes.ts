import { Router } from "express";
import { env } from "../../config/env.js";
import { requireAuth, userId } from "../../middleware/auth.js";
import { UsageDaily } from "../../models/usage-daily.js";

const router = Router();
router.use(requireAuth);
router.get("/usage", async (req, res) => {
  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10);
  const usage = await UsageDaily.findOne({ userId: userId(req), dateKey }).lean();
  const used = Math.max(0, usage?.pointsUsed ?? 0);
  const resetsAt = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  ).toISOString();
  return res.json({
    data: {
      dateKey,
      limit: env.DAILY_POINTS_LIMIT,
      used,
      remaining: Math.max(0, env.DAILY_POINTS_LIMIT - used),
      resetsAt
    },
    meta: { requestId: null }
  });
});
export default router;
