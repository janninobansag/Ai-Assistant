import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { env } from "../../config/env.js";
import { requireAuth, userId } from "../../middleware/auth.js";
import { Conversation } from "../../models/conversation.js";
import { Material } from "../../models/material.js";
import { Message } from "../../models/message.js";
import { Subject } from "../../models/subject.js";
import { UsageDaily } from "../../models/usage-daily.js";
import { streamGroundedAnswer } from "../../services/ai/chat-provider.js";
import { extendConversationSummary, RECENT_MESSAGE_LIMIT } from "../../services/conversations/context.js";
import { retrieveChunks } from "../../services/retrieval/keyword.js";

const router = Router();
const conversationInput = z.object({ subjectId: z.string().length(24), materialIds: z.array(z.string().length(24)).min(1).max(10), title: z.string().trim().min(1).max(120).optional() });
const messageInput = z.object({ content: z.string().trim().min(1).max(2000), clientMessageId: z.string().trim().min(1).max(100).optional(), allowGeneralKnowledge: z.literal(false).optional() });
const item = (conversation: any) => ({ id: conversation.id ?? String(conversation._id), subjectId: String(conversation.subjectId), materialIds: conversation.materialIds.map(String), title: conversation.title, lastMessageAt: conversation.lastMessageAt, archivedAt: conversation.archivedAt });
const writeEvent = (res: any, event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

async function refreshConversationContext(conversation: any, owner: string) {
  const filter = { conversationId: conversation.id, userId: owner, status: { $in: ["completed", "interrupted"] } };
  const messageCount = await Message.countDocuments(filter);
  const previousCount = Math.min(conversation.summaryMessageCount ?? 0, messageCount);
  const summarizedCount = Math.max(0, messageCount - RECENT_MESSAGE_LIMIT);
  const updates: Record<string, unknown> = { lastMessageAt: new Date() };
  if (summarizedCount > previousCount) {
    const newlyOlder = await Message.find(filter)
      .sort({ createdAt: 1 })
      .skip(previousCount)
      .limit(summarizedCount - previousCount)
      .select("role content")
      .lean();
    updates.summary = extendConversationSummary(conversation.summary ?? "", newlyOlder);
    updates.summaryMessageCount = summarizedCount;
  }
  await Conversation.updateOne({ _id: conversation.id, userId: owner }, { $set: updates });
}
router.use(requireAuth);

router.get("/conversations", async (req, res) => res.json({ data: (await Conversation.find({ userId: userId(req), archivedAt: { $exists: false }, ...(typeof req.query.subjectId === "string" ? { subjectId: req.query.subjectId } : {}) }).sort({ lastMessageAt: -1 }).limit(30)).map(item), meta: { requestId: null } }));
router.post("/conversations", async (req, res) => {
  const parsed = conversationInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Choose a subject and at least one material.", requestId: null } });
  const owner = userId(req);
  const subject = await Subject.exists({ _id: parsed.data.subjectId, userId: owner, status: "active" });
  const materials = await Material.find({ _id: { $in: parsed.data.materialIds }, userId: owner, subjectId: parsed.data.subjectId, archivedAt: { $exists: false } }).select("_id title");
  if (!subject || materials.length !== parsed.data.materialIds.length) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Selected study material was not found.", requestId: null } });
  const conversation = await Conversation.create({ userId: owner, ...parsed.data, title: parsed.data.title ?? `Tutor: ${materials[0]!.title}` });
  return res.status(201).json({ data: item(conversation), meta: { requestId: null } });
});
router.get("/conversations/:conversationId", async (req, res) => {
  const conversation = await Conversation.findOne({ _id: req.params.conversationId, userId: userId(req) });
  if (!conversation) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Conversation not found.", requestId: null } });
  const messages = await Message.find({ conversationId: conversation.id, userId: userId(req) }).sort({ createdAt: -1 }).limit(RECENT_MESSAGE_LIMIT).lean();
  return res.json({ data: { ...item(conversation), messages: messages.reverse() }, meta: { requestId: null } });
});
router.post("/conversations/:conversationId/messages", async (req, res) => {
  const parsed = messageInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Enter a question of up to 2,000 characters.", requestId: null } });
  const owner = userId(req);
  const conversation = await Conversation.findOne({ _id: req.params.conversationId, userId: owner, archivedAt: { $exists: false } });
  if (!conversation) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Conversation not found.", requestId: null } });
  if (parsed.data.clientMessageId) {
    const existing = await Message.findOne({ userId: owner, clientMessageId: parsed.data.clientMessageId });
    if (existing) return res.status(409).json({ error: { code: "CONFLICT", message: "This message was already sent.", requestId: null } });
  }
  const dateKey = new Date().toISOString().slice(0, 10);
  const usage = await UsageDaily.findOne({ userId: owner, dateKey });
  if ((usage?.pointsUsed ?? 0) + 1 > env.DAILY_POINTS_LIMIT) return res.status(429).json({ error: { code: "AI_QUOTA_EXCEEDED", message: "Daily AI limit reached.", requestId: null } });
  await UsageDaily.findOneAndUpdate({ userId: owner, dateKey }, { $setOnInsert: { userId: owner, dateKey }, $inc: { pointsUsed: 1, operations: 1 } }, { upsert: true });
  const userMessage = await Message.create({ userId: owner, conversationId: conversation.id, role: "user", content: parsed.data.content, status: "completed", clientMessageId: parsed.data.clientMessageId });
  // Existing MongoDB deployments may have a non-sparse unique clientMessageId index.
  // Give internal assistant rows their own opaque id so they never collide on null.
  const assistant = await Message.create({ userId: owner, conversationId: conversation.id, role: "assistant", content: "", status: "streaming", clientMessageId: `assistant-${randomUUID()}` });
  res.status(200).set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  res.flushHeaders();
  writeEvent(res, "accepted", { userMessageId: userMessage.id, assistantMessageId: assistant.id });
  let cancelled = false;
  const abort = new AbortController();
  req.on("aborted", () => { cancelled = true; abort.abort(); });
  try {
    const history = await Message.find({ conversationId: conversation.id, userId: owner, _id: { $ne: assistant._id }, status: { $in: ["completed", "interrupted"] } }).sort({ createdAt: -1 }).limit(RECENT_MESSAGE_LIMIT).lean();
    const sources = await retrieveChunks(owner, conversation.materialIds.map(String), parsed.data.content);
    let answer = "";
    const priorSummary = typeof conversation.summary === "string" ? conversation.summary : "";
    for await (const part of streamGroundedAnswer(parsed.data.content, sources, history.reverse().map((message) => ({ role: message.role, content: message.content ?? "" })), priorSummary, abort.signal)) {
      if (cancelled) break;
      answer += part; writeEvent(res, "delta", { text: part });
    }
    if (cancelled) { await Message.updateOne({ _id: assistant.id }, { $set: { status: "interrupted", content: answer } }); return; }
    const citations = sources.map((source) => ({ materialId: source.materialId, chunkId: source.chunkId, label: source.label }));
    await Message.updateOne({ _id: assistant.id }, { $set: { content: answer, citations, status: "completed" } });
    try {
      await refreshConversationContext(conversation, owner);
    } catch (contextError) {
      // The reply is already safely stored. A compression failure must not turn
      // a successful answer into an apparent provider failure or charge refund.
      console.error("Conversation context refresh failed", contextError);
      await Conversation.updateOne({ _id: conversation.id, userId: owner }, { $set: { lastMessageAt: new Date() } });
    }
    writeEvent(res, "citations", { items: citations }); writeEvent(res, "done", { usage: { points: 1 } }); res.end();
  } catch (error) {
    if (cancelled) {
      await Message.updateOne({ _id: assistant.id }, { $set: { status: "interrupted" } });
      return;
    }
    await UsageDaily.updateOne({ userId: owner, dateKey }, { $inc: { pointsUsed: -1, operations: -1 } });
    await Message.updateOne({ _id: assistant.id }, { $set: { status: "failed" } }); writeEvent(res, "error", { message: error instanceof Error ? error.message : "Tutor unavailable." }); res.end();
  }
});
router.post("/conversations/:conversationId/archive", async (req, res) => {
  const found = await Conversation.findOneAndUpdate({ _id: req.params.conversationId, userId: userId(req), archivedAt: { $exists: false } }, { $set: { archivedAt: new Date() } }, { new: true });
  return found ? res.json({ data: item(found), meta: { requestId: null } }) : res.status(404).json({ error: { code: "NOT_FOUND", message: "Conversation not found.", requestId: null } });
});
export default router;
