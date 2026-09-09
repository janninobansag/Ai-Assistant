export type MaterialChunkInput = {
  ordinal: number;
  heading?: string;
  text: string;
  tokenEstimate: number;
};

/** Creates bounded, overlapping chunks while preserving paragraph boundaries. */
export function chunkMaterial(
  text: string,
  maxCharacters = 1800,
  overlapCharacters = 180
): MaterialChunkInput[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  const chunks: MaterialChunkInput[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 2 > maxCharacters) {
      chunks.push({
        ordinal: chunks.length,
        text: current,
        tokenEstimate: Math.ceil(current.length / 4)
      });
      current = `${current.slice(-overlapCharacters)}\n\n${paragraph}`;
    } else current = current ? `${current}\n\n${paragraph}` : paragraph;
  }
  if (current)
    chunks.push({
      ordinal: chunks.length,
      text: current,
      tokenEstimate: Math.ceil(current.length / 4)
    });
  return chunks;
}
