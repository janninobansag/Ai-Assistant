import { Schema, model, Types } from "mongoose";

const materialChunkSchema = new Schema(
  {
    userId: { type: Types.ObjectId, required: true, index: true },
    materialId: { type: Types.ObjectId, required: true, index: true },
    subjectId: { type: Types.ObjectId, required: true, index: true },
    ordinal: { type: Number, required: true },
    heading: String,
    text: { type: String, required: true },
    tokenEstimate: { type: Number, required: true }
  },
  { timestamps: true }
);
materialChunkSchema.index({ materialId: 1, ordinal: 1 }, { unique: true });
materialChunkSchema.index({ userId: 1, subjectId: 1 });
materialChunkSchema.index({ heading: "text", text: "text" });
export const MaterialChunk = model("MaterialChunk", materialChunkSchema);
