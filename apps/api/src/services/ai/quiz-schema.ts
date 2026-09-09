import { z } from "zod";
export const quizOutputSchema = z.object({
  title: z.string().min(1).max(160),
  questions: z
    .array(
      z.object({
        prompt: z.string().min(1).max(500),
        options: z.array(z.string().min(1).max(250)).length(4),
        correctIndex: z.number().int().min(0).max(3),
        explanation: z.string().min(1).max(500),
        concept: z.string().min(1).max(120)
      })
    )
    .min(1)
    .max(15)
});
export type QuizOutput = z.infer<typeof quizOutputSchema>;
