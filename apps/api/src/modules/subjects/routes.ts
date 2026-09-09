import { Router } from "express";
import { z } from "zod";
import { Subject } from "../../models/subject.js";
import { Material } from "../../models/material.js";
import { MaterialChunk } from "../../models/material-chunk.js";
import { requireAuth, userId } from "../../middleware/auth.js";
const router = Router();
const subjectInput = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240).optional(),
  colorKey: z.string().trim().max(30).optional()
});
router.use(requireAuth);
router.get("/", async (req, res) =>
  res.json({
    data: await Subject.find({
      userId: userId(req),
      status: req.query.archived === "true" ? "archived" : "active"
    }).sort({ updatedAt: -1 }),
    meta: { requestId: null }
  })
);
router.post("/", async (req, res) => {
  const parsed = subjectInput.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "A subject name is required.", requestId: null }
    });
  const subject = await Subject.create({ ...parsed.data, userId: userId(req) });
  return res.status(201).json({ data: subject, meta: { requestId: null } });
});
router.get("/:subjectId", async (req, res) => {
  const found = await Subject.findOne({ _id: req.params.subjectId, userId: userId(req) });
  return found
    ? res.json({ data: found, meta: { requestId: null } })
    : res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "Subject not found.", requestId: null } });
});
router.patch("/:subjectId", async (req, res) => {
  const parsed = subjectInput.partial().safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Check your subject details.", requestId: null }
    });
  const found = await Subject.findOneAndUpdate(
    { _id: req.params.subjectId, userId: userId(req) },
    { $set: parsed.data },
    { new: true }
  );
  return found
    ? res.json({ data: found, meta: { requestId: null } })
    : res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "Subject not found.", requestId: null } });
});
router.post("/:subjectId/archive", async (req, res) => {
  const found = await Subject.findOneAndUpdate(
    { _id: req.params.subjectId, userId: userId(req) },
    { $set: { status: "archived" } },
    { new: true }
  );
  return found
    ? res.json({ data: found, meta: { requestId: null } })
    : res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "Subject not found.", requestId: null } });
});
router.post("/:subjectId/restore", async (req, res) => {
  const found = await Subject.findOneAndUpdate(
    { _id: req.params.subjectId, userId: userId(req) },
    { $set: { status: "active" } },
    { new: true }
  );
  return found
    ? res.json({ data: found, meta: { requestId: null } })
    : res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "Subject not found.", requestId: null } });
});
router.delete("/:subjectId", async (req, res) => {
  const found = await Subject.findOneAndDelete({ _id: req.params.subjectId, userId: userId(req) });
  if (!found)
    return res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Subject not found.", requestId: null } });
  const materials = await Material.find({ subjectId: found.id, userId: userId(req) }).select("_id");
  await Material.deleteMany({ subjectId: found.id, userId: userId(req) });
  await MaterialChunk.deleteMany({
    materialId: { $in: materials.map((item) => item._id) },
    userId: userId(req)
  });
  return res.status(204).end();
});
export default router;
