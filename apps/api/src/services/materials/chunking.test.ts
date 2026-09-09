import { describe, expect, it } from "vitest";
import { chunkMaterial } from "./chunking.js";

describe("chunkMaterial", () => {
  it("creates bounded overlapping chunks", () => {
    const chunks = chunkMaterial(
      `${"Alpha paragraph. ".repeat(10)}\n\n${"Beta paragraph. ".repeat(10)}`,
      300,
      40
    );
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.ordinal).toBe(0);
    expect(chunks.every((chunk) => chunk.text.length <= 340)).toBe(true);
    expect(chunks[1]?.text).toContain("Beta paragraph");
  });

  it("ignores empty paragraphs", () => {
    expect(chunkMaterial("  One paragraph.\n\n\n  ")).toHaveLength(1);
  });
});
