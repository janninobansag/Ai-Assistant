import type { RequestHandler } from "express";
import { verifyToken } from "../lib/tokens.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export const requireAuth: RequestHandler = (req, res, next) => {
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  const payload = token ? verifyToken(token, "access") : null;
  if (!payload)
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
