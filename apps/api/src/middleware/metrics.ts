import type { RequestHandler } from "express";

const startedAt = Date.now();
const requests = new Map<string, number>();

const routeGroup = (path: string) => {
  if (path.startsWith("/api/v1/auth")) return "auth";
  if (path.startsWith("/api/v1/materials")) return "materials";
  if (path.startsWith("/api/v1/quizzes") || path.startsWith("/api/v1/attempts")) return "quizzes";
  if (path.startsWith("/api/v1/conversations")) return "conversations";
  if (path.startsWith("/api/v1/health")) return "health";
  return "other";
};

export const collectMetrics: RequestHandler = (req, res, next) => {
  res.on("finish", () => {
    const key = `${req.method} ${routeGroup(req.path)} ${Math.floor(res.statusCode / 100)}xx`;
    requests.set(key, (requests.get(key) ?? 0) + 1);
  });
  next();
};

export const metricsSnapshot = () => ({ uptimeSeconds: Math.floor((Date.now() - startedAt) / 1_000), requests: Object.fromEntries(requests) });
