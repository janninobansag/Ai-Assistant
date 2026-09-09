import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { requireAuth, userId } from "../../middleware/auth.js";
import { Material } from "../../models/material.js";
import { Summary } from "../../models/summary.js";
import { UsageDaily } from "../../models/usage-daily.js";
import { promptVersion } from "../../services/ai/provider.js";
import { generateLongSummary } from "../../services/ai/long-summary.js";
import { summaryOutputSchema } from "../../services/ai/schema.js";
const router = Router();
const input = z.object({
  style: z.enum(["concise", "detailed", "bullets"]).default("concise"),
  forceRegenerate: z.boolean().default(false)
});
router.use(requireAuth);
router.post("/materials/:materialId/summaries", async (req, res) => {
  const parsed = input.safeParse(req.body ?? {});
  if (!parsed.success)
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Invalid summary options.", requestId: null }
    });
  const owner = userId(req);
  const material = await Material.findOne({
    _id: req.params.materialId,
    userId: owner,
    archivedAt: { $exists: false }
  });
  if (!material)
    return res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Material not found.", requestId: null } });
  if (!parsed.data.forceRegenerate) {
    const cached = await Summary.findOne({
      userId: owner,
      materialId: material.id,
      sourceContentHash: material.contentHash,
      style: parsed.data.style,
      promptVersion
    }).sort({ createdAt: -1 });
    if (cached) return res.json({ data: cached, meta: { cached: true, requestId: null } });
  }
  const dateKey = new Date().toISOString().slice(0, 10);
  const cost = 3;
  const existing = await UsageDaily.findOne({ userId: owner, dateKey });
  if ((existing?.pointsUsed ?? 0) + cost > env.DAILY_POINTS_LIMIT)
    return res.status(429).json({
      error: { code: "AI_QUOTA_EXCEEDED", message: "Daily AI limit reached.", requestId: null }
    });
  await UsageDaily.findOneAndUpdate(
    { userId: owner, dateKey },
    { $setOnInsert: { userId: owner, dateKey }, $inc: { pointsUsed: cost, operations: 1 } },
    { upsert: true, new: true }
  );
  const started = Date.now();
  try {
    const output = summaryOutputSchema.parse(
      await generateLongSummary(material.id, material.normalizedText, parsed.data.style)
    );
    const saved = await Summary.create({
      ...output,
      userId: owner,
      subjectId: material.subjectId,
      materialId: material.id,
      sourceContentHash: material.contentHash,
      promptVersion,
      style: parsed.data.style,
      provider: env.AI_PROVIDER,
      model: env.AI_PROVIDER === "hosted" ? env.HOSTED_AI_MODEL : "fake",
      latencyMs: Date.now() - started
    });
    return res.status(201).json({ data: saved, meta: { cached: false, requestId: null } });
  } catch (error) {
    await UsageDaily.updateOne(
      { userId: owner, dateKey },
      { $inc: { pointsUsed: -cost, operations: -1 } }
    );
    const message =
      error instanceof SyntaxError || error instanceof z.ZodError
        ? "AI returned invalid structured output."
        : (error as Error).message;
    const code = message.includes("not configured")
      ? "AI_PROVIDER_UNAVAILABLE"
      : "AI_OUTPUT_INVALID";
    return res.status(502).json({ error: { code, message, requestId: null } });
  }
});
router.get("/materials/:materialId/summaries", async (req, res) => {
  const items = await Summary.find({ materialId: req.params.materialId, userId: userId(req) })
    .sort({ createdAt: -1 })
    .limit(20);
  return res.json({ data: items, meta: { requestId: null } });
});
export default router;
