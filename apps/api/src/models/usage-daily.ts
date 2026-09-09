import { Schema, Types, model } from "mongoose";
const usageSchema = new Schema(
  {
    userId: { type: Types.ObjectId, required: true },
    dateKey: { type: String, required: true },
    pointsUsed: { type: Number, default: 0 },
    operations: { type: Number, default: 0 }
  },
  { timestamps: true }
);
usageSchema.index({ userId: 1, dateKey: 1 }, { unique: true });
export const UsageDaily = model("UsageDaily", usageSchema);
