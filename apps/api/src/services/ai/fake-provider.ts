export type SummaryStyle = "concise" | "detailed" | "bullets";
export interface SummaryResult {
  overview: string;
  keyPoints: string[];
  definitions: Array<{ term: string; meaning: string }>;
  rememberThis: string[];
}
/** Deterministic provider for local development and tests; it makes no network calls. */
export class FakeProvider {
  async generateSummary(text: string, style: SummaryStyle): Promise<SummaryResult> {
    const firstSentence = (
      text.trim().split(/[.!?]\s/)[0] || "Your material is ready to review."
    ).slice(0, 400);
    const words = text.trim().split(/\s+/).filter(Boolean);
    return {
      overview: `${style === "detailed" ? "Detailed overview" : "Quick overview"}: ${firstSentence}`,
      keyPoints: words.length
        ? [
            `Review the main idea: ${firstSentence}`,
            `This material contains approximately ${words.length} words.`
          ]
        : ["Add more source text to generate useful study notes."],
      definitions: [],
      rememberThis: ["Check each key point against the original material."]
    };
  }
}
