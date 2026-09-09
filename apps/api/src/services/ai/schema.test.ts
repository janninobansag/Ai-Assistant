import { describe, expect, it } from "vitest";
import { FakeProvider } from "./fake-provider.js";
import { summaryOutputSchema } from "./schema.js";

describe("summary output", () => {
  it("keeps deterministic long-note output within schema limits", async () => {
    const output = await new FakeProvider().generateSummary("word ".repeat(12000), "concise");
    expect(summaryOutputSchema.parse(output)).toEqual(output);
  });
});
