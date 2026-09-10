import { Schema, Types, model } from "mongoose";

const messageSchema = new Schema(
  {
    userId: { type: Types.ObjectId, required: true, index: true },
    conversationId: { type: Types.ObjectId, required: true, index: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    // Assistant messages are created before their first streamed token arrives.
    content: {
      type: String,
      required: function (this: { status?: string }) {
        return this.status !== "streaming";
      },
      maxlength: 8000
    },
    status: {
      type: String,
      enum: ["pending", "streaming", "completed", "interrupted", "failed"],
      required: true
    },
    citations: [
      {
        materialId: { type: Types.ObjectId, required: true },
        chunkId: { type: Types.ObjectId, required: true },
        label: { type: String, required: true }
      }
    ],
    clientMessageId: { type: String, maxlength: 100 }
  },
  { timestamps: true }
);
messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ userId: 1, clientMessageId: 1 }, { unique: true, sparse: true });
export const Message = model("Message", messageSchema);
