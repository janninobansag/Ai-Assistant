import { describe, expect, it } from "vitest";
import { findQuestions } from "./questions.js";

describe("findQuestions", () => {
  it("finds question lines from imported study notes", () => {
    expect(
      findQuestions("What is photosynthesis?\nIt converts light into chemical energy.")
    ).toHaveLength(1);
  });

  it("does not treat ordinary notes as questions", () => {
    expect(
      findQuestions("Photosynthesis converts light energy into chemical energy.")
    ).toHaveLength(0);
  });
});
