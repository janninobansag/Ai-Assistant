import { Schema, Types, model } from "mongoose";
const quizSchema = new Schema(
  {
    userId: { type: Types.ObjectId, required: true, index: true },
    materialId: { type: Types.ObjectId, required: true, index: true },
    subjectId: { type: Types.ObjectId, required: true, index: true },
    title: { type: String, required: true },
    difficulty: { type: String, enum: ["easy", "mixed", "hard"], required: true },
    questionCount: { type: Number, required: true },
    sourceContentHash: { type: String, required: true },
    promptVersion: { type: String, required: true },
    questions: [{ prompt: String, options: [String], correctIndex: Number, explanation: String }]
  },
  { timestamps: true }
);
quizSchema.index({
  userId: 1,
  materialId: 1,
  sourceContentHash: 1,
  difficulty: 1,
  questionCount: 1,
  promptVersion: 1
});
export const Quiz = model("Quiz", quizSchema);
