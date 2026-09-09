import { Schema, model, Types } from "mongoose";
const subjectSchema = new Schema(
  {
    userId: { type: Types.ObjectId, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, maxlength: 240 },
    colorKey: { type: String, default: "blue" },
    status: { type: String, enum: ["active", "archived"], default: "active", index: true },
    lastStudiedAt: Date
  },
  { timestamps: true }
);
subjectSchema.index({ userId: 1, status: 1, updatedAt: -1 });
export const Subject = model("Subject", subjectSchema);
