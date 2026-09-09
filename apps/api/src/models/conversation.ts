import { Schema, Types, model } from "mongoose";

const conversationSchema = new Schema(
  {
    userId: { type: Types.ObjectId, required: true, index: true },
    subjectId: { type: Types.ObjectId, required: true, index: true },
    materialIds: [{ type: Types.ObjectId, required: true }],
    title: { type: String, required: true, maxlength: 120 },
    summary: { type: String, default: "" },
    // Number of chronological messages already represented in `summary`.
    summaryMessageCount: { type: Number, default: 0, min: 0 },
    lastMessageAt: { type: Date, default: Date.now },
    archivedAt: Date
  },
  { timestamps: true }
);
conversationSchema.index({ userId: 1, archivedAt: 1, lastMessageAt: -1 });
conversationSchema.index({ userId: 1, materialIds: 1 });
export const Conversation = model("Conversation", conversationSchema);
