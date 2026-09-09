import { z } from "zod";

export const summaryStyleSchema = z.enum(["concise", "detailed", "bullets"]);
export const difficultySchema = z.enum(["easy", "mixed", "hard"]);
export const errorCodeSchema = z.enum([
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION_ERROR",
  "CONFLICT",
  "RATE_LIMITED",
  "AI_QUOTA_EXCEEDED",
  "AI_PROVIDER_UNAVAILABLE",
  "AI_OUTPUT_INVALID",
  "INTERNAL_ERROR"
]);
export const apiErrorSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    fields: z.record(z.string()).optional(),
    requestId: z.string()
  })
});
export const summaryRequestSchema = z.object({
  style: summaryStyleSchema.default("concise"),
  forceRegenerate: z.boolean().default(false)
});
export const quizRequestSchema = z.object({
  questionCount: z.union([z.literal(5), z.literal(10), z.literal(15)]).default(5),
  difficulty: difficultySchema.default("mixed"),
  forceRegenerate: z.boolean().default(false)
});
export type SummaryStyle = z.infer<typeof summaryStyleSchema>;
export type Difficulty = z.infer<typeof difficultySchema>;
