import { Schema, Types, model } from "mongoose";
const attemptSchema = new Schema(
  {
    userId: { type: Types.ObjectId, required: true, index: true },
    quizId: { type: Types.ObjectId, required: true, index: true },
    answers: [
      {
        questionId: { type: String, required: true },
        selectedIndex: { type: Number, required: true, min: 0, max: 3 },
        answeredAt: { type: Date, required: true }
      }
    ],
    status: { type: String, enum: ["in_progress", "submitted"], default: "in_progress" },
    score: Number,
    correctCount: Number,
    weakConcepts: [
      {
        concept: { type: String, required: true },
        incorrectCount: { type: Number, required: true },
        totalQuestions: { type: Number, required: true }
      }
    ],
    submittedAt: Date
  },
  { timestamps: true }
);
attemptSchema.index({ userId: 1, quizId: 1, status: 1 });
attemptSchema.index({ userId: 1, status: 1, updatedAt: -1 });
export const QuizAttempt = model("QuizAttempt", attemptSchema);
