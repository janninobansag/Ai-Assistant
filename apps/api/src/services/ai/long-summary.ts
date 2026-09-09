import { MaterialChunk } from "../../models/material-chunk.js";
import { generateSummary } from "./provider.js";
import type { SummaryStyle, SummaryResult } from "./fake-provider.js";

/** Map-reduce summary for long notes: summarize bounded chunks, then synthesize the partials. */
export async function generateLongSummary(
  materialId: string,
  text: string,
  style: SummaryStyle
): Promise<SummaryResult> {
  const chunks = await MaterialChunk.find({ materialId }).sort({ ordinal: 1 }).lean();
  if (chunks.length <= 1 && text.length <= 8000) return generateSummary(text, style);
  const partials: SummaryResult[] = [];
  for (const chunk of chunks)
    partials.push(await generateSummary(chunk.text.slice(0, 8000), "bullets"));
  const synthesis = partials
    .map((item, index) => `PART ${index + 1}\n${item.overview}\n${item.keyPoints.join("\n")}`)
    .join("\n\n");
  return generateSummary(
    `Synthesize these partial summaries into one ${style} study summary.\n${synthesis}`,
    style
  );
}
