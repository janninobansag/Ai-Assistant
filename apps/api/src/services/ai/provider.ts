import { env } from "../../config/env.js";
import { FakeProvider, type SummaryStyle, type SummaryResult } from "./fake-provider.js";
import { summaryOutputSchema, type SummaryOutput } from "./schema.js";
import { hostedFetch } from "./circuit-breaker.js";

const fake = new FakeProvider();
const promptVersion = "summary-v1";
export { promptVersion };

function prompt(text: string, style: SummaryStyle) {
  return `Summarize the following study material in ${style} style. Return JSON only matching this schema: {"overview":string,"keyPoints":string[],"definitions":[{"term":string,"meaning":string}],"rememberThis":string[]}. Do not include markdown.\n\nMATERIAL:\n${text}`;
}

async function gemini(text: string, style: SummaryStyle): Promise<SummaryOutput> {
  if (!env.GEMINI_API_KEY) throw new Error("Hosted AI is not configured.");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.HOSTED_AI_MODEL)}:generateContent`;
  const response = await hostedFetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt(text, style) }] }] }),
    signal: AbortSignal.timeout(30_000)
  });
  const body = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const raw = body.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!raw) throw new Error("Hosted AI returned no content.");
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed = JSON.parse(cleaned) as unknown;
  return summaryOutputSchema.parse(parsed);
}

export async function generateSummary(text: string, style: SummaryStyle): Promise<SummaryResult> {
  if (env.AI_PROVIDER === "fake") return fake.generateSummary(text, style);
  return gemini(text, style);
}
