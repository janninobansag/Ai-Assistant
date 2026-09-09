import type { Difficulty } from "@study/shared";
import type { QuizOutput } from "./quiz-schema.js";
export async function generateQuiz(
  text: string,
  count: number,
  difficulty: Difficulty
): Promise<QuizOutput> {
  const snippet = text.trim().slice(0, 300);
  const label = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  return {
    title: `${label} practice quiz`,
    questions: Array.from({ length: count }, (_, index) => ({
      prompt: `What should you remember about this material? (Question ${index + 1})`,
      options: [
        snippet || "Review the material",
        "A random unrelated fact",
        "No information",
        "None of the above"
      ],
      correctIndex: 0,
      explanation: "The answer is grounded in the supplied material."
    }))
  };
}
