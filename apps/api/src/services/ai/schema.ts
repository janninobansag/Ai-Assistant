import { z } from "zod";

export const summaryOutputSchema = z.object({
  overview: z.string().min(1).max(2000),
  keyPoints: z.array(z.string().min(1).max(500)).min(1).max(12),
  definitions: z
    .array(z.object({ term: z.string().min(1).max(120), meaning: z.string().min(1).max(500) }))
    .max(20),
  rememberThis: z.array(z.string().min(1).max(300)).max(12)
});
export type SummaryOutput = z.infer<typeof summaryOutputSchema>;
