import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// npm workspaces run API scripts from apps/api; explicitly load the root .env.
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  MONGODB_URI: z.string().default("mongodb://127.0.0.1:27017/ai-study-assistant"),
  ACCESS_TOKEN_SECRET: z.string().min(32).default("development-access-secret-change-me-32chars"),
  REFRESH_TOKEN_SECRET: z.string().min(32).default("development-refresh-secret-change-me-32"),
  ACCESS_TOKEN_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(30),
  AI_PROVIDER: z.enum(["fake", "hosted"]).default("fake"),
  HOSTED_AI_PROVIDER: z.enum(["gemini"]).default("gemini"),
  HOSTED_AI_MODEL: z.string().default("gemini-2.0-flash"),
  GEMINI_API_KEY: z.string().optional(),
  DAILY_POINTS_LIMIT: z.coerce.number().int().positive().default(20),
  GLOBAL_DAILY_AI_OPERATIONS: z.coerce.number().int().positive().default(500),
  AI_MONTHLY_SPEND_LIMIT_USD: z.coerce.number().nonnegative().default(0)
});
export const env = envSchema.parse(process.env);
