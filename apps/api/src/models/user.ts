import { Schema, model } from "mongoose";
const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, required: true, trim: true, maxlength: 80 },
    lastActiveAt: { type: Date, index: true },
    preferences: {
      answerLength: { type: String, enum: ["short", "normal", "detailed"], default: "normal" },
      theme: { type: String, enum: ["system", "light", "dark"], default: "system" }
    }
  },
  { timestamps: true }
);
export const User = model("User", userSchema);
