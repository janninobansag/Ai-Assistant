import { Router } from "express";
import { z } from "zod";
import { User } from "../../models/user.js";
import { RefreshSession } from "../../models/refresh-session.js";
import { hashPassword, verifyPassword } from "../../lib/passwords.js";
import { createToken, hashToken, verifyToken } from "../../lib/tokens.js";
import { requireAuth, userId } from "../../middleware/auth.js";
import { Subject } from "../../models/subject.js";
import { Material } from "../../models/material.js";
import { MaterialChunk } from "../../models/material-chunk.js";
import { Summary } from "../../models/summary.js";
import { Quiz } from "../../models/quiz.js";
import { QuizAttempt } from "../../models/quiz-attempt.js";
import { Conversation } from "../../models/conversation.js";
import { Message } from "../../models/message.js";
import { UsageDaily } from "../../models/usage-daily.js";

const router = Router();
const credentials = z.object({
  email: z
    .string()
    .email()
    .transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128)
});
const profile = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  answerLength: z.enum(["short", "normal", "detailed"]).optional(),
  theme: z.enum(["system", "light", "dark"]).optional()
});
const deleteAccountInput = z.object({ password: z.string().min(8).max(128) });
const cookie = (name: string, value: string, maxAge: number) =>
  `${name}=${value}; Max-Age=${maxAge}; Path=/api/v1/auth; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
const publicUser = (u: any) => ({
  id: u._id.toString(),
  email: u.email,
  displayName: u.displayName,
  preferences: u.preferences
});
const issueRefreshSession = async (userId: string) => {
  const token = createToken(userId, "refresh");
  const payload = verifyToken(token, "refresh");
  if (!payload?.jti) throw new Error("Refresh token could not be created");
  await RefreshSession.create({
    userId,
    tokenHash: hashToken(token),
    jti: payload.jti,
    expiresAt: new Date(payload.exp * 1000)
  });
  return token;
};

router.post("/register", async (req, res) => {
  const parsed = credentials
    .extend({ displayName: z.string().trim().min(1).max(80) })
    .safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Check your registration details.",
        fields: parsed.error.flatten().fieldErrors,
        requestId: null
      }
    });
  if (await User.exists({ email: parsed.data.email }))
    return res.status(409).json({
      error: {
        code: "CONFLICT",
        message: "An account with that email already exists.",
        requestId: null
      }
    });
  const created = await User.create({
    email: parsed.data.email,
    displayName: parsed.data.displayName,
    passwordHash: await hashPassword(parsed.data.password)
  });
  res.setHeader(
    "Set-Cookie",
    cookie("refreshToken", await issueRefreshSession(created.id), 30 * 86400)
  );
  return res.status(201).json({
    data: { user: publicUser(created), accessToken: createToken(created.id, "access") },
    meta: { requestId: null }
  });
});

router.post("/login", async (req, res) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Enter a valid email and password.",
        requestId: null
      }
    });
  const found = await User.findOne({ email: parsed.data.email });
  if (!found || !(await verifyPassword(parsed.data.password, found.passwordHash)))
    return res.status(401).json({
      error: {
        code: "UNAUTHENTICATED",
        message: "Email or password is incorrect.",
        requestId: null
      }
    });
  res.setHeader(
    "Set-Cookie",
    cookie("refreshToken", await issueRefreshSession(found.id), 30 * 86400)
  );
  return res.json({
    data: { user: publicUser(found), accessToken: createToken(found.id, "access") },
    meta: { requestId: null }
  });
});

router.post("/refresh", async (req, res) => {
  const raw = req.headers.cookie?.match(/(?:^|;\s*)refreshToken=([^;]+)/)?.[1];
  const payload = raw ? verifyToken(raw, "refresh") : null;
  if (!payload || !payload.jti || !(await User.exists({ _id: payload.sub })))
    return res.status(401).json({
      error: { code: "UNAUTHENTICATED", message: "Refresh session expired.", requestId: null }
    });
  const session = await RefreshSession.findOne({
    tokenHash: raw ? hashToken(raw) : "",
    jti: payload.jti
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    if (session?.revokedAt)
      await RefreshSession.updateMany(
        { userId: payload.sub, revokedAt: { $exists: false } },
        { $set: { revokedAt: new Date() } }
      );
    return res.status(401).json({
      error: {
        code: "UNAUTHENTICATED",
        message: "Refresh session expired or was already used.",
        requestId: null
      }
    });
  }
  const nextRefresh = await issueRefreshSession(payload.sub);
  const nextPayload = verifyToken(nextRefresh, "refresh");
  await RefreshSession.findByIdAndUpdate(session.id, {
    $set: {
      revokedAt: new Date(),
      replacedBySessionId: nextPayload?.jti
        ? (await RefreshSession.findOne({ jti: nextPayload.jti }))?._id
        : undefined
    }
  });
  res.setHeader("Set-Cookie", cookie("refreshToken", nextRefresh, 30 * 86400));
  return res.json({
    data: { accessToken: createToken(payload.sub, "access") },
    meta: { requestId: null }
  });
});

router.post("/logout", async (req, res) => {
  const raw = req.headers.cookie?.match(/(?:^|;\s*)refreshToken=([^;]+)/)?.[1];
  if (raw)
    await RefreshSession.findOneAndUpdate(
      { tokenHash: hashToken(raw) },
      { $set: { revokedAt: new Date() } }
    );
  res.setHeader("Set-Cookie", cookie("refreshToken", "", 0));
  return res.status(204).end();
});
router.post("/logout-all", requireAuth, async (req, res) => {
  await RefreshSession.updateMany(
    { userId: userId(req), revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } }
  );
  res.setHeader("Set-Cookie", cookie("refreshToken", "", 0));
  return res.status(204).end();
});
router.get("/me", requireAuth, async (req, res) => {
  const found = await User.findById(userId(req));
  if (!found) return res.status(404).end();
  return res.json({ data: { user: publicUser(found) }, meta: { requestId: null } });
});
router.patch("/me", requireAuth, async (req, res) => {
  const parsed = profile.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Check your profile details.", requestId: null }
    });
  const update: Record<string, string> = {};
  if (parsed.data.displayName) update.displayName = parsed.data.displayName;
  if (parsed.data.answerLength) update["preferences.answerLength"] = parsed.data.answerLength;
  if (parsed.data.theme) update["preferences.theme"] = parsed.data.theme;
  const found = await User.findByIdAndUpdate(userId(req), { $set: update }, { new: true });
  return res.json({ data: { user: found ? publicUser(found) : null }, meta: { requestId: null } });
});
router.get("/me/export", requireAuth, async (req, res) => {
  const owner = userId(req);
  const account = await User.findById(owner).lean();
  if (!account)
    return res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Account not found.", requestId: null } });
  const [subjects, materials, chunks, summaries, quizzes, attempts, conversations, messages] =
    await Promise.all([
      Subject.find({ userId: owner }).lean(),
      Material.find({ userId: owner }).lean(),
      MaterialChunk.find({ userId: owner }).lean(),
      Summary.find({ userId: owner }).lean(),
      Quiz.find({ userId: owner }).lean(),
      QuizAttempt.find({ userId: owner }).lean(),
      Conversation.find({ userId: owner }).lean(),
      Message.find({ userId: owner }).lean()
    ]);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="study-assistant-export-${new Date().toISOString().slice(0, 10)}.json"`
  );
  return res.json({
    data: {
      exportedAt: new Date().toISOString(),
      account: {
        id: String(account._id),
        email: account.email,
        displayName: account.displayName,
        preferences: account.preferences,
        createdAt: account.createdAt
      },
      subjects,
      materials,
      chunks,
      summaries,
      quizzes,
      attempts,
      conversations,
      messages
    },
    meta: { requestId: null }
  });
});
router.delete("/me", requireAuth, async (req, res) => {
  const parsed = deleteAccountInput.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Enter your password to delete the account.",
        requestId: null
      }
    });
  const owner = userId(req);
  const account = await User.findById(owner);
  if (!account || !(await verifyPassword(parsed.data.password, account.passwordHash)))
    return res.status(401).json({
      error: { code: "UNAUTHENTICATED", message: "Password is incorrect.", requestId: null }
    });
  await Promise.all([
    RefreshSession.deleteMany({ userId: owner }),
    Subject.deleteMany({ userId: owner }),
    Material.deleteMany({ userId: owner }),
    MaterialChunk.deleteMany({ userId: owner }),
    Summary.deleteMany({ userId: owner }),
    Quiz.deleteMany({ userId: owner }),
    QuizAttempt.deleteMany({ userId: owner }),
    Conversation.deleteMany({ userId: owner }),
    Message.deleteMany({ userId: owner }),
    UsageDaily.deleteMany({ userId: owner })
  ]);
  await User.deleteOne({ _id: owner });
  res.setHeader("Set-Cookie", cookie("refreshToken", "", 0));
  return res.status(204).end();
});
export default router;
