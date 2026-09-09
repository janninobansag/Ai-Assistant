import { Schema, model, Types } from "mongoose";

const refreshSessionSchema = new Schema(
  {
    userId: { type: Types.ObjectId, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    jti: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
    replacedBySessionId: { type: Types.ObjectId }
  },
  { timestamps: true }
);
refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshSessionSchema.index({ userId: 1, revokedAt: 1 });
export const RefreshSession = model("RefreshSession", refreshSessionSchema);
