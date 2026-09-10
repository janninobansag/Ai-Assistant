import type { RequestHandler } from "express";
import { verifyToken } from "../lib/tokens.js";
import { User } from "../models/user.js";
import { adminEmails } from "../config/env.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  const payload = token ? verifyToken(token, "access") : null;
  if (!payload)
    return res
      .status(401)
      .json({ error: { code: "UNAUTHENTICATED", message: "Sign in required.", requestId: null } });
  const accountExists = await User.exists({ _id: payload.sub });
  if (!accountExists)
    return res
      .status(401)
      .json({ error: { code: "UNAUTHENTICATED", message: "Sign in required.", requestId: null } });
  req.userId = payload.sub;
  return next();
};

export const userId = (req: Express.Request): string => {
  if (!req.userId) throw new Error("Authenticated user missing");
  return req.userId;
};

export const requireAdmin: RequestHandler = async (req, res, next) => {
  if (!req.userId)
    return res
      .status(401)
      .json({ error: { code: "UNAUTHENTICATED", message: "Sign in required.", requestId: null } });
  const account = await User.findById(req.userId).select("email").lean();
  if (!account || !adminEmails.has(account.email.toLowerCase()))
    return res.status(403).json({
      error: { code: "FORBIDDEN", message: "Administrator access is required.", requestId: null }
    });
  return next();
};
