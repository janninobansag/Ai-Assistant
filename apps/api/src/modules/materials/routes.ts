import { createHash } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { z } from "zod";
import { Material } from "../../models/material.js";
import { MaterialChunk } from "../../models/material-chunk.js";
import { QuizAttempt } from "../../models/quiz-attempt.js";
import { Quiz } from "../../models/quiz.js";
import { Summary } from "../../models/summary.js";
import { Subject } from "../../models/subject.js";
import { requireAuth, userId } from "../../middleware/auth.js";
import { chunkMaterial } from "../../services/materials/chunking.js";
const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }
});
const materialInput = z.object({
  subjectId: z.string().length(24),
  title: z.string().trim().min(1).max(120),
  text: z.string().trim().min(100).max(50000),
  formattedText: z.string().max(200000).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([])
});
const normalize = (text: string) =>
  text
    .normalize("NFKC")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
const sanitizeFormattedText = (html: string) => {
  const allowedTags = new Set([
    "b",
    "strong",
    "i",
    "em",
    "u",
    "h2",
    "ul",
    "ol",
    "li",
    "br",
    "div",
    "p"
  ]);
  return html.replace(/<\/?([a-z0-9]+)(?:\s[^>]*)?>/gi, (tag, name: string) => {
    const normalized = name.toLowerCase();
    if (!allowedTags.has(normalized)) return "";
    return tag.startsWith("</") ? `</${normalized}>` : `<${normalized}>`;
  });
};
router.use(requireAuth);
router.post("/import", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file)
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Choose a file to import.", requestId: null }
    });
  const extension = file.originalname.split(".").pop()?.toLowerCase();
  if (!extension || !["pdf", "docx", "txt"].includes(extension))
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Only PDF, DOCX, and TXT files can be imported.",
        requestId: null
      }
    });
  try {
    let text = "";
    if (extension === "pdf") {
      const parser = new PDFParse({ data: file.buffer });
      try {
        text = (await parser.getText()).text;
      } finally {
        await parser.destroy();
      }
    } else if (extension === "docx") {
      text = (await mammoth.extractRawText({ buffer: file.buffer })).value;
    } else {
      text = file.buffer.toString("utf8");
    }
    const normalizedText = normalize(text);
    if (!normalizedText)
      return res.status(422).json({
        error: {
          code: "UNPROCESSABLE_FILE",
          message: "No readable text was found in this file.",
          requestId: null
        }
      });
    if (normalizedText.length > 50_000)
      return res.status(422).json({
        error: {
          code: "FILE_TOO_LARGE",
          message: "This file contains more than 50,000 characters. Import a shorter document.",
          requestId: null
        }
      });
    return res.json({
      data: { text: normalizedText, fileName: file.originalname },
      meta: { requestId: null }
    });
  } catch {
    return res.status(422).json({
      error: {
        code: "UNPROCESSABLE_FILE",
        message: "This file could not be read. Try another PDF, DOCX, or TXT file.",
        requestId: null
      }
    });
  }
});
router.get("/", async (req, res) => {
  const query: Record<string, unknown> = { userId: userId(req), archivedAt: { $exists: false } };
  if (typeof req.query.subjectId === "string") query.subjectId = req.query.subjectId;
  if (typeof req.query.q === "string" && req.query.q.trim())
    query.title = { $regex: req.query.q.trim(), $options: "i" };
  return res.json({
    data: await Material.find(query).sort({ updatedAt: -1 }),
    meta: { requestId: null }
  });
});
router.post("/", async (req, res) => {
  const parsed = materialInput.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Provide a title and at least 100 characters of study text.",
        requestId: null
      }
    });
  const owner = userId(req);
  if (!(await Subject.exists({ _id: parsed.data.subjectId, userId: owner, status: "active" })))
    return res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Subject not found.", requestId: null } });
  const normalizedText = normalize(parsed.data.text);
  const material = await Material.create({
    userId: owner,
    subjectId: parsed.data.subjectId,
    title: parsed.data.title,
    rawText: parsed.data.text,
    formattedText: parsed.data.formattedText
      ? sanitizeFormattedText(parsed.data.formattedText)
      : "",
    normalizedText,
    contentHash: createHash("sha256").update(normalizedText).digest("hex"),
    tags: parsed.data.tags,
    characterCount: normalizedText.length
  });
  await MaterialChunk.insertMany(
    chunkMaterial(normalizedText).map((chunk) => ({
      ...chunk,
      userId: owner,
      materialId: material.id,
      subjectId: parsed.data.subjectId
    }))
  );
  return res.status(201).json({ data: material, meta: { requestId: null } });
});
router.get("/:materialId", async (req, res) => {
  const found = await Material.findOne({
    _id: req.params.materialId,
    userId: userId(req),
    archivedAt: { $exists: false }
  });
  return found
    ? res.json({ data: found, meta: { requestId: null } })
    : res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "Material not found.", requestId: null } });
});
router.get("/:materialId/chunks/:chunkId", async (req, res) => {
  const chunk = await MaterialChunk.findOne({
    _id: req.params.chunkId,
    materialId: req.params.materialId,
    userId: userId(req)
  }).select("materialId ordinal heading text");
  return chunk
    ? res.json({
        data: {
          id: chunk.id,
          materialId: String(chunk.materialId),
          label: chunk.heading || `Section ${chunk.ordinal + 1}`,
          text: chunk.text
        },
        meta: { requestId: null }
      })
    : res.status(404).json({
        error: { code: "NOT_FOUND", message: "Source excerpt not found.", requestId: null }
      });
});
router.patch("/:materialId", async (req, res) => {
  const parsed = materialInput
    .pick({ title: true, text: true, formattedText: true, tags: true })
    .partial()
    .safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Check your material details.",
        requestId: null
      }
    });
  const update: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.formattedText !== undefined)
    update.formattedText = sanitizeFormattedText(parsed.data.formattedText);
  if (parsed.data.text) {
    update.rawText = parsed.data.text;
    update.normalizedText = normalize(parsed.data.text);
    update.characterCount = (update.normalizedText as string).length;
    update.contentHash = createHash("sha256")
      .update(update.normalizedText as string)
      .digest("hex");
    delete update.text;
  }
  const found = await Material.findOneAndUpdate(
    { _id: req.params.materialId, userId: userId(req), archivedAt: { $exists: false } },
    { $set: update },
    { new: true }
  );
  if (found && parsed.data.text) {
    await MaterialChunk.deleteMany({ materialId: found.id, userId: userId(req) });
    await MaterialChunk.insertMany(
      chunkMaterial(found.normalizedText).map((chunk) => ({
        ...chunk,
        userId: userId(req),
        materialId: found.id,
        subjectId: found.subjectId
      }))
    );
    const quizzes = await Quiz.find({ materialId: found.id, userId: userId(req) })
      .select("_id")
      .lean();
    await Summary.deleteMany({ materialId: found.id, userId: userId(req) });
    await QuizAttempt.deleteMany({
      quizId: { $in: quizzes.map((quiz) => quiz._id) },
      userId: userId(req)
    });
    await Quiz.deleteMany({ materialId: found.id, userId: userId(req) });
  }
  return found
    ? res.json({ data: found, meta: { requestId: null } })
    : res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "Material not found.", requestId: null } });
});
router.post("/:materialId/archive", async (req, res) => {
  const found = await Material.findOneAndUpdate(
    { _id: req.params.materialId, userId: userId(req), archivedAt: { $exists: false } },
    { $set: { archivedAt: new Date() } },
    { new: true }
  );
  return found
    ? res.json({ data: found, meta: { requestId: null } })
    : res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "Material not found.", requestId: null } });
});
router.delete("/:materialId", async (req, res) => {
  const owner = userId(req);
  const found = await Material.findOneAndDelete({
    _id: req.params.materialId,
    userId: owner
  });
  if (!found)
    return res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Material not found.", requestId: null } });
  const quizzes = await Quiz.find({ materialId: found.id, userId: owner }).select("_id").lean();
  await MaterialChunk.deleteMany({ materialId: found.id, userId: owner });
  await Summary.deleteMany({ materialId: found.id, userId: owner });
  await QuizAttempt.deleteMany({ quizId: { $in: quizzes.map((quiz) => quiz._id) }, userId: owner });
  await Quiz.deleteMany({ materialId: found.id, userId: owner });
  return res.status(204).end();
});
export default router;
