import { MaterialChunk } from "../../models/material-chunk.js";

const terms = (value: string) =>
  [...new Set(value.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [])].slice(0, 20);

export async function retrieveChunks(userId: string, materialIds: string[], question: string) {
  const queryTerms = terms(question);
  const chunks = await MaterialChunk.find({ userId, materialId: { $in: materialIds } })
    .select("materialId ordinal heading text")
    .lean();
  return chunks
    .map((chunk) => {
      const searchable = `${chunk.heading ?? ""} ${chunk.text}`.toLowerCase();
      return { chunk, score: queryTerms.reduce((total, term) => total + (searchable.includes(term) ? 1 : 0), 0) };
    })
    .sort((a, b) => b.score - a.score || a.chunk.ordinal - b.chunk.ordinal)
    .filter((item, index) => item.score > 0 || index < 2)
    .slice(0, 4)
    .map(({ chunk }) => ({
      chunkId: String(chunk._id), materialId: String(chunk.materialId), label: chunk.heading || `Section ${chunk.ordinal + 1}`,
      text: chunk.text.slice(0, 1800)
    }));
}
