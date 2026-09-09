import { describe, expect, it } from "vitest";
import { difficultySchema, quizRequestSchema, summaryRequestSchema } from "./index.js";

describe("shared generation contracts", () => {
  it("applies safe defaults to summary requests", () => {
    expect(summaryRequestSchema.parse({})).toEqual({ style: "concise", forceRegenerate: false });
  });

  it("accepts only supported quiz sizes", () => {
    expect(quizRequestSchema.parse({ questionCount: 10 }).questionCount).toBe(10);
    expect(() => quizRequestSchema.parse({ questionCount: 7 })).toThrow();
  });

  it("rejects unknown difficulty values", () => {
    expect(difficultySchema.safeParse("expert").success).toBe(false);
  });
});
