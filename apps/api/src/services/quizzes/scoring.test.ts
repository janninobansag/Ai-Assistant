import { describe, expect, it } from "vitest";
import { scoreQuiz } from "./scoring.js";

const questions = [
  { id: "a", correctIndex: 0, concept: "Cells" },
  { id: "b", correctIndex: 1, concept: "Cells" },
  { id: "c", correctIndex: 2, concept: "Genes" }
];

describe("quiz scoring", () => {
  it("scores blank submissions and identifies all weak concepts", () => {
    expect(scoreQuiz(questions, [])).toEqual({
      correctCount: 0,
      score: 0,
      weakConcepts: [
        { concept: "Cells", incorrectCount: 2, totalQuestions: 2 },
        { concept: "Genes", incorrectCount: 1, totalQuestions: 1 }
      ]
    });
  });

  it("scores partial and complete submissions", () => {
    expect(scoreQuiz(questions, [{ questionId: "a", selectedIndex: 0 }])).toMatchObject({
      correctCount: 1,
      score: 33
    });
    expect(
      scoreQuiz(questions, [
        { questionId: "a", selectedIndex: 0 },
        { questionId: "b", selectedIndex: 1 },
        { questionId: "c", selectedIndex: 2 }
      ])
    ).toEqual({ correctCount: 3, score: 100, weakConcepts: [] });
  });
});
