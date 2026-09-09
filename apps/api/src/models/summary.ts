import { Schema, Types, model } from "mongoose";
const summarySchema = new Schema(
  {
    userId: { type: Types.ObjectId, required: true, index: true },
    subjectId: { type: Types.ObjectId, required: true, index: true },
    materialId: { type: Types.ObjectId, required: true, index: true },
    sourceContentHash: { type: String, required: true },
    promptVersion: { type: String, required: true },
    style: { type: String, enum: ["concise", "detailed", "bullets"], required: true },
    overview: { type: String, required: true },
    keyPoints: { type: [String], required: true },
    definitions: { type: [{ term: String, meaning: String }], default: [] },
    rememberThis: { type: [String], default: [] },
    provider: String,
    model: String,
    status: { type: String, enum: ["completed"], default: "completed" }
  },
  { timestamps: true }
);
summarySchema.index({ userId: 1, materialId: 1, sourceContentHash: 1, style: 1, promptVersion: 1 });
export const Summary = model("Summary", summarySchema);
