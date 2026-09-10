import { describe, expect, it } from "vitest";
import { extendConversationSummary } from "./context.js";

describe("extendConversationSummary", () => {
  it("adds compact role-labelled notes without inventing content", () => {
    expect(
      extendConversationSummary("Student: Earlier topic", [
        { role: "assistant", content: "  The material defines mitosis as cell division.  " },
        { role: "user", content: "How many cells result?" }
      ])
    ).toBe(
      "Student: Earlier topic\nTutor: The material defines mitosis as cell division.\nStudent: How many cells result?"
    );
  });
});
