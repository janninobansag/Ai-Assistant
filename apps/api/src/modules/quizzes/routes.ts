import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { requireAuth, userId } from "../../middleware/auth.js";
import { Material } from "../../models/material.js";
import { Quiz } from "../../models/quiz.js";
import { QuizAttempt } from "../../models/quiz-attempt.js";
import { generateQuiz } from "../../services/ai/quiz-provider.js";
import { quizOutputSchema } from "../../services/ai/quiz-schema.js";
import { scoreQuiz } from "../../services/quizzes/scoring.js";
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
const publicAttempt = (attempt: any) => ({
  id: attempt.id ?? String(attempt._id),
  quizId: String(attempt.quizId),
  status: attempt.status,
  answers: attempt.answers.map((answer: any) => ({
    questionId: answer.questionId,
    selectedIndex: answer.selectedIndex,
    answeredAt: answer.answeredAt
  })),
  score: attempt.score,
  correctCount: attempt.correctCount,
  weakConcepts: attempt.weakConcepts ?? [],
  startedAt: attempt.createdAt,
  submittedAt: attempt.submittedAt,
  updatedAt: attempt.updatedAt
});
const answersInput = z
  .array(z.object({ questionId: z.string().length(24), selectedIndex: z.number().int().min(0).max(3) }))
  .max(15)
  .superRefine((answers, context) => {
    const ids = new Set<string>();
    answers.forEach((answer, index) => {
      if (ids.has(answer.questionId))
        context.addIssue({ code: z.ZodIssueCode.custom, message: "Questions may only be answered once.", path: [index, "questionId"] });
      ids.add(answer.questionId);
    });
  });
const resultFor = (attempt: any, quiz: any) => ({
  ...publicAttempt(attempt),
  total: quiz.questions.length,
  explanations: quiz.questions.map((question: any) => ({
    questionId: String(question._id),
    prompt: question.prompt,
    selectedIndex: attempt.answers.find((answer: any) => answer.questionId === String(question._id))?.selectedIndex ?? null,
    correctIndex: question.correctIndex,
    explanation: question.explanation,
    concept: question.concept,
    isCorrect:
      attempt.answers.find((answer: any) => answer.questionId === String(question._id))?.selectedIndex ===
      question.correctIndex
  }))
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
    // Provider is part of the cache key: a fake local quiz must never be served after switching to hosted AI.
    promptVersion: "quiz-v2",
    generationProvider: env.AI_PROVIDER
  };
  if (!parsed.data.forceRegenerate) {
    const cached = await Quiz.findOne(query).sort({ createdAt: -1 });
    if (cached)
      return res.json({ data: publicQuiz(cached), meta: { cached: true, requestId: null } });
  }
  try {
    const output = quizOutputSchema.parse(
      await generateQuiz(material.normalizedText, parsed.data.questionCount, parsed.data.difficulty)
    );
    if (output.questions.length !== parsed.data.questionCount)
      throw new z.ZodError([
        { code: z.ZodIssueCode.custom, path: ["questions"], message: "Unexpected question count." }
      ]);
    const quiz = await Quiz.create({ ...output, ...query, subjectId: material.subjectId });
    return res
      .status(201)
      .json({ data: publicQuiz(quiz), meta: { cached: false, requestId: null } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Quiz generation failed.";
    const code = message.includes("not configured")
      ? "AI_PROVIDER_UNAVAILABLE"
      : "AI_OUTPUT_INVALID";
    return res
      .status(502)
      .json({
        error: {
          code,
          message:
            code === "AI_PROVIDER_UNAVAILABLE"
              ? message
              : "Quiz generation returned invalid output. Try again.",
          requestId: null
        }
      });
  }
});
router.get("/materials/:materialId/quizzes", async (req, res) => {
  const quizzes = await Quiz.find({ materialId: req.params.materialId, userId: userId(req) })
    .sort({ createdAt: -1 })
    .limit(20);
  return res.json({ data: quizzes.map(publicQuiz), meta: { requestId: null } });
});
router.post("/quizzes/:quizId/attempts", async (req, res) => {
  const quiz = await Quiz.findOne({ _id: req.params.quizId, userId: userId(req) });
  if (!quiz)
    return res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Quiz not found.", requestId: null } });
  const attempt = await QuizAttempt.findOneAndUpdate(
    { quizId: quiz.id, userId: userId(req), status: "in_progress" },
    { $setOnInsert: { quizId: quiz.id, userId: userId(req), answers: [] } },
    { upsert: true, new: true }
  );
  return res.status(201).json({ data: publicAttempt(attempt), meta: { requestId: null } });
});
router.patch("/attempts/:attemptId", async (req, res) => {
  const parsed = z.object({ answers: answersInput }).safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ error: { code: "VALIDATION_ERROR", message: "Invalid answers.", requestId: null } });
  const existing = await QuizAttempt.findOne({
    _id: req.params.attemptId,
    userId: userId(req),
    status: "in_progress"
  });
  if (!existing)
    return res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Attempt not found.", requestId: null } });
  const quiz = await Quiz.findOne({ _id: existing.quizId, userId: userId(req) });
  if (!quiz)
    return res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Quiz not found.", requestId: null } });
  const validQuestionIds = new Set(quiz.questions.map((question) => String(question._id)));
  if (parsed.data.answers.some((answer) => !validQuestionIds.has(answer.questionId)))
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Answers must belong to this quiz.", requestId: null }
    });
  const attempt = await QuizAttempt.findOneAndUpdate(
    { _id: existing.id, userId: userId(req), status: "in_progress" },
    { $set: { answers: parsed.data.answers.map((answer) => ({ ...answer, answeredAt: new Date() })) } },
    { new: true }
  );
  return attempt
    ? res.json({ data: publicAttempt(attempt), meta: { requestId: null } })
    : res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "Attempt not found.", requestId: null } });
});
router.post("/attempts/:attemptId/submit", async (req, res) => {
  const attempt = await QuizAttempt.findOne({ _id: req.params.attemptId, userId: userId(req) });
  if (!attempt)
    return res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Attempt not found.", requestId: null } });
  const quiz = await Quiz.findOne({ _id: attempt.quizId, userId: userId(req) });
  if (!quiz)
    return res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Quiz not found.", requestId: null } });
  if (attempt.status === "submitted")
    return res.json({ data: resultFor(attempt, quiz), meta: { idempotent: true, requestId: null } });
  const scoring = scoreQuiz(
    quiz.questions.map((question) => ({
      id: String(question._id),
      correctIndex: question.correctIndex,
      concept: question.concept
    })),
    attempt.answers.map((answer) => ({
      questionId: answer.questionId,
      selectedIndex: answer.selectedIndex
    }))
  );
  const submittedAt = new Date();
  const saved = await QuizAttempt.findOneAndUpdate(
    { _id: attempt.id, userId: userId(req), status: "in_progress" },
    { $set: { score: scoring.score, correctCount: scoring.correctCount, weakConcepts: scoring.weakConcepts, status: "submitted", submittedAt } },
    { new: true }
  );
  const finalAttempt = saved ?? (await QuizAttempt.findOne({ _id: attempt.id, userId: userId(req) }));
  if (!finalAttempt)
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Attempt not found.", requestId: null } });
  return res.json({
    data: resultFor(finalAttempt, quiz),
    meta: { idempotent: !saved, requestId: null }
  });
});
router.get("/quizzes/:quizId/attempts", async (req, res) => {
  const items = await QuizAttempt.find({ quizId: req.params.quizId, userId: userId(req) }).sort({
    createdAt: -1
  });
  return res.json({ data: items.map(publicAttempt), meta: { requestId: null } });
});
router.post("/attempts/:attemptId/retry", async (req, res) => {
  const attempt = await QuizAttempt.findOne({
    _id: req.params.attemptId,
    userId: userId(req),
    status: "submitted"
  });
  if (!attempt)
    return res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Submitted attempt not found.", requestId: null } });
  const source = await Quiz.findOne({ _id: attempt.quizId, userId: userId(req) });
  if (!source)
    return res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Quiz not found.", requestId: null } });
  const selected = new Map(attempt.answers.map((answer) => [answer.questionId, answer.selectedIndex]));
  const incorrect = source.questions.filter(
    (question) => selected.get(String(question._id)) !== question.correctIndex
  );
  if (incorrect.length === 0)
    return res.status(409).json({
      error: { code: "CONFLICT", message: "There are no incorrect questions to retry.", requestId: null }
    });
  const retryQuiz = await Quiz.create({
    userId: userId(req),
    subjectId: source.subjectId,
    materialId: source.materialId,
    sourceContentHash: source.sourceContentHash,
    promptVersion: source.promptVersion,
    generationProvider: source.generationProvider ?? env.AI_PROVIDER,
    difficulty: source.difficulty,
    questionCount: incorrect.length,
    title: `Retry: ${source.title}`,
    questions: incorrect.map((question) => ({
      prompt: question.prompt,
      options: question.options,
      correctIndex: question.correctIndex,
      explanation: question.explanation,
      concept: question.concept
    }))
  });
  const retryAttempt = await QuizAttempt.create({ userId: userId(req), quizId: retryQuiz.id, answers: [] });
  return res.status(201).json({
    data: { quiz: publicQuiz(retryQuiz), attempt: publicAttempt(retryAttempt) },
    meta: { requestId: null }
  });
});
router.get("/practice/history", async (req, res) => {
  const items = await QuizAttempt.find({ userId: userId(req), status: "submitted" })
    .sort({ submittedAt: -1 })
    .limit(50)
    .lean();
  const quizzes = await Quiz.find({
    _id: { $in: items.map((attempt) => attempt.quizId) },
    userId: userId(req)
  }).lean();
  const quizById = new Map(quizzes.map((quiz) => [String(quiz._id), quiz]));
  return res.json({
    data: items.flatMap((attempt) => {
      const quiz = quizById.get(String(attempt.quizId));
      return quiz
        ? [{ ...publicAttempt(attempt), quiz: { id: String(quiz._id), title: quiz.title, materialId: String(quiz.materialId), difficulty: quiz.difficulty, questionCount: quiz.questionCount } }]
        : [];
    }),
    meta: { requestId: null }
  });
});
router.delete("/practice/history/:attemptId", async (req, res) => {
  const deleted = await QuizAttempt.findOneAndDelete({
    _id: req.params.attemptId,
    userId: userId(req),
    status: "submitted"
  });
  return deleted
    ? res.status(204).end()
    : res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "Completed attempt not found.", requestId: null } });
});
export default router;
