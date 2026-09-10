import cors from "cors";
import express, { type RequestHandler } from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { env } from "./config/env.js";
import { isDatabaseReady } from "./config/database.js";
import { FakeProvider } from "./services/ai/fake-provider.js";
import authRoutes from "./modules/auth/routes.js";
import subjectRoutes from "./modules/subjects/routes.js";
import materialRoutes from "./modules/materials/routes.js";
import summaryRoutes from "./modules/summaries/routes.js";
import quizRoutes from "./modules/quizzes/routes.js";
import conversationRoutes from "./modules/conversations/routes.js";
import usageRoutes from "./modules/usage/routes.js";
import { rateLimit } from "./middleware/rate-limit.js";
import { collectMetrics, metricsSnapshot } from "./middleware/metrics.js";
const pinoMiddleware = pinoHttp as unknown as (options?: object) => RequestHandler;
export const app = express();
export const fakeProvider = new FakeProvider();
app.use(helmet());
app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(
  pinoMiddleware({
    redact: ["req.headers.authorization", "req.headers.cookie", "res.headers.set-cookie"]
  })
);
app.use(collectMetrics);
app.use("/api", rateLimit({ name: "api", windowMs: 60_000, max: env.API_RATE_LIMIT_PER_MINUTE }));
app.use(
  "/api/v1/auth",
  rateLimit({ name: "auth", windowMs: 15 * 60_000, max: env.AUTH_RATE_LIMIT_PER_15_MINUTES })
);
app.get("/api/v1/health/live", (_req, res) =>
  res.json({ data: { status: "ok" }, meta: { requestId: null } })
);
app.get("/api/v1/health/ready", (_req, res) => {
  const databaseReady = isDatabaseReady();
  return res.status(databaseReady ? 200 : 503).json({
    data: {
      status: databaseReady ? "ready" : "not_ready",
      database: databaseReady ? "connected" : "disconnected",
      aiProvider: env.AI_PROVIDER
    },
    meta: { requestId: null }
  });
});
app.get("/api/v1/health/metrics", (_req, res) =>
  res.json({
    data: { ...metricsSnapshot(), database: isDatabaseReady() ? "connected" : "disconnected" },
    meta: { requestId: null }
  })
);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/subjects", subjectRoutes);
app.use("/api/v1/materials", materialRoutes);
app.use("/api/v1", summaryRoutes);
app.use("/api/v1", quizRoutes);
app.use("/api/v1", conversationRoutes);
app.use("/api/v1", usageRoutes);
app.get("/api/v1/dev/fake-summary", async (req, res) => {
  if (env.NODE_ENV === "production") return res.status(404).end();
  const text =
    typeof req.query.text === "string"
      ? req.query.text
      : "Mitosis creates two genetically identical cells.";
  return res.json({
    data: await fakeProvider.generateSummary(text, "concise"),
    meta: { provider: "fake" }
  });
});
