import { Router } from "express";
import { z } from "zod";
import { Subject } from "../../models/subject.js";
import { Material } from "../../models/material.js";
import { MaterialChunk } from "../../models/material-chunk.js";
import { Summary } from "../../models/summary.js";
import { Quiz } from "../../models/quiz.js";
import { QuizAttempt } from "../../models/quiz-attempt.js";
import { Conversation } from "../../models/conversation.js";
import { Message } from "../../models/message.js";
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
  const owner = userId(req);
  const found = await Subject.findOneAndDelete({ _id: req.params.subjectId, userId: owner });
  if (!found)
    return res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Subject not found.", requestId: null } });
  const materials = await Material.find({ subjectId: found.id, userId: owner }).select("_id");
  const materialIds = materials.map((item) => item._id);
  const quizzes = await Quiz.find({ materialId: { $in: materialIds }, userId: owner }).select(
    "_id"
  );
  const conversations = await Conversation.find({ subjectId: found.id, userId: owner }).select(
    "_id"
  );
  await Promise.all([
    Material.deleteMany({ subjectId: found.id, userId: owner }),
    MaterialChunk.deleteMany({ materialId: { $in: materialIds }, userId: owner }),
    Summary.deleteMany({ materialId: { $in: materialIds }, userId: owner }),
    QuizAttempt.deleteMany({ quizId: { $in: quizzes.map((quiz) => quiz._id) }, userId: owner }),
    Quiz.deleteMany({ materialId: { $in: materialIds }, userId: owner }),
    Message.deleteMany({
      conversationId: { $in: conversations.map((item) => item._id) },
      userId: owner
    }),
    Conversation.deleteMany({ subjectId: found.id, userId: owner })
  ]);
  return res.status(204).end();
});
export default router;
