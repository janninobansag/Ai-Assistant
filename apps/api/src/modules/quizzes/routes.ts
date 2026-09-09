import { Router } from "express";
import { z } from "zod";
import { requireAuth, userId } from "../../middleware/auth.js";
import { Material } from "../../models/material.js";
import { Quiz } from "../../models/quiz.js";
import { generateQuiz } from "../../services/ai/quiz-provider.js";
import { quizOutputSchema } from "../../services/ai/quiz-schema.js";
const router = Router();
const input = z.object({
  questionCount: z.union([z.literal(5), z.literal(10), z.literal(15)]).default(5),
  difficulty: z.enum(["easy", "mixed", "hard"]).default("mixed"),
  forceRegenerate: z.boolean().default(false)
});
const publicQuiz = (quiz: any) => ({
  id: quiz.id,
  materialId: quiz.materialId,
  subjectId: quiz.subjectId,
  title: quiz.title,
  difficulty: quiz.difficulty,
  questionCount: quiz.questionCount,
  questions: quiz.questions.map((q: any) => ({ id: q._id, prompt: q.prompt, options: q.options }))
});
router.use(requireAuth);
router.post("/materials/:materialId/quizzes", async (req, res) => {
  const parsed = input.safeParse(req.body ?? {});
  if (!parsed.success)
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Invalid quiz options.", requestId: null }
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
  const query = {
    userId: owner,
    materialId: material.id,
    sourceContentHash: material.contentHash,
    difficulty: parsed.data.difficulty,
    questionCount: parsed.data.questionCount,
    promptVersion: "quiz-v1"
  };
  if (!parsed.data.forceRegenerate) {
    const cached = await Quiz.findOne(query).sort({ createdAt: -1 });
    if (cached)
      return res.json({ data: publicQuiz(cached), meta: { cached: true, requestId: null } });
  }
  const output = quizOutputSchema.parse(
    await generateQuiz(material.normalizedText, parsed.data.questionCount, parsed.data.difficulty)
  );
  const quiz = await Quiz.create({ ...output, ...query, subjectId: material.subjectId });
  return res.status(201).json({ data: publicQuiz(quiz), meta: { cached: false, requestId: null } });
});
router.get("/materials/:materialId/quizzes", async (req, res) => {
  const quizzes = await Quiz.find({ materialId: req.params.materialId, userId: userId(req) })
    .sort({ createdAt: -1 })
    .limit(20);
  return res.json({ data: quizzes.map(publicQuiz), meta: { requestId: null } });
});
export default router;
