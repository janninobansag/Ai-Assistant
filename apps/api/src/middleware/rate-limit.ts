import type { RequestHandler } from "express";

type Entry = { count: number; resetAt: number };

/** In-memory limiter for a single API process. Use a shared store when scaling to multiple instances. */
export function rateLimit({
  windowMs,
  max,
  name
}: {
  windowMs: number;
  max: number;
  name: string;
}): RequestHandler {
  const entries = new Map<string, Entry>();
  return (req, res, next) => {
    const now = Date.now();
    const key = `${name}:${req.ip}`;
    const current = entries.get(key);
    const entry =
      !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    entry.count += 1;
    entries.set(key, entry);
    res.setHeader("RateLimit-Limit", max);
    res.setHeader("RateLimit-Remaining", Math.max(0, max - entry.count));
    res.setHeader("RateLimit-Reset", Math.ceil(entry.resetAt / 1000));
    if (entry.count > max)
      return res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Please try again shortly.",
          requestId: null
        }
      });
    return next();
  };
}
