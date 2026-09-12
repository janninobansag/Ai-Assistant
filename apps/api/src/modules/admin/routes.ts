import { Router } from "express";
import { z } from "zod";
import { User } from "../../models/user.js";
import { RefreshSession } from "../../models/refresh-session.js";
import { hashPassword } from "../../lib/passwords.js";
import { requireAdmin, requireAuth, userId } from "../../middleware/auth.js";
import { permanentlyDeleteAccount } from "../../services/accounts/delete-account-data.js";

const router = Router();
const passwordInput = z.object({ password: z.string().min(8).max(128) });
const deleteInput = z.object({ confirmation: z.string().max(300) });
const ACTIVE_WINDOW_MS = 90_000;

router.use(requireAuth, requireAdmin);

router.get("/users", async (_req, res) => {
  const users = await User.find({})
    .select("email displayName createdAt updatedAt lastActiveAt")
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  return res.json({
    data: users.map((account) => ({
      id: String(account._id),
      email: account.email,
      displayName: account.displayName,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      isActive: account.lastActiveAt
        ? Date.now() - account.lastActiveAt.getTime() < ACTIVE_WINDOW_MS
        : false
    })),
    meta: { requestId: null }
  });
});

router.patch("/users/:id/password", async (req, res) => {
  const parsed = passwordInput.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "The new password must contain at least 8 characters.",
        requestId: null
      }
    });
  const account = await User.findByIdAndUpdate(
    req.params.id,
    { $set: { passwordHash: await hashPassword(parsed.data.password) } },
    { new: true }
  );
  if (!account)
    return res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "User not found.", requestId: null } });
  await permanentlyDeleteSessions(account.id);
  req.log.info({ adminId: userId(req), targetUserId: account.id }, "admin changed user password");
  return res.json({
    data: { id: account.id, email: account.email, displayName: account.displayName },
    meta: { requestId: null }
  });
});

router.delete("/users/:id", async (req, res) => {
  const parsed = deleteInput.safeParse(req.body);
  const account = await User.findById(req.params.id);
  if (!account)
    return res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "User not found.", requestId: null } });
  if (account.id === userId(req))
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Use account settings to delete your own account.",
        requestId: null
      }
    });
  if (!parsed.success || parsed.data.confirmation !== `DELETE ${account.email}`)
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: `Type DELETE ${account.email} to permanently delete this user.`,
        requestId: null
      }
    });
  const targetUserId = account.id;
  await permanentlyDeleteAccount(targetUserId);
  req.log.warn({ adminId: userId(req), targetUserId }, "admin permanently deleted user");
  return res.status(204).end();
});

async function permanentlyDeleteSessions(accountId: string): Promise<void> {
  await RefreshSession.deleteMany({ userId: accountId });
}

export default router;
