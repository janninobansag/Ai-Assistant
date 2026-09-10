import { Schema, model, Types } from "mongoose";
const materialSchema = new Schema(
  {
    userId: { type: Types.ObjectId, required: true, index: true },
    subjectId: { type: Types.ObjectId, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    sourceType: { type: String, enum: ["text"], default: "text" },
    rawText: { type: String, required: true, maxlength: 50000 },
    formattedText: { type: String, maxlength: 200000, default: "" },
    normalizedText: { type: String, required: true },
    contentHash: { type: String, required: true },
    tags: { type: [String], default: [] },
    characterCount: { type: Number, required: true },
    processingStatus: { type: String, enum: ["ready", "failed"], default: "ready" },
    archivedAt: Date
  },
  { timestamps: true }
);
materialSchema.index({ userId: 1, subjectId: 1, archivedAt: 1 });
materialSchema.index({ userId: 1, contentHash: 1 });
export const Material = model("Material", materialSchema);
