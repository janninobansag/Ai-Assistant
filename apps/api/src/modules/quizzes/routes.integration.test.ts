import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { app } from "../../app.js";
import { Quiz } from "../../models/quiz.js";

let mongo: MongoMemoryServer;
let token: string;
let quizId: string;
let questionIds: string[];
let materialId: string;

describe("quiz attempts", () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri("quiz-test"));
    const registered = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "quiz@example.com", password: "secure-password", displayName: "Quiz User" });
    token = registered.body.data.accessToken;
    const userId = registered.body.data.user.id;
    materialId = new mongoose.Types.ObjectId().toString();
    const quiz = await Quiz.create({
      userId,
      materialId,
      subjectId: new mongoose.Types.ObjectId(),
      sourceContentHash: "source-hash",
      promptVersion: "quiz-v1",
      generationProvider: "fake",
      title: "Cells",
      difficulty: "mixed",
      questionCount: 3,
      questions: [
        { prompt: "Q1", options: ["a", "b", "c", "d"], correctIndex: 0, explanation: "E1", concept: "Cells" },
        { prompt: "Q2", options: ["a", "b", "c", "d"], correctIndex: 1, explanation: "E2", concept: "Cells" },
        { prompt: "Q3", options: ["a", "b", "c", "d"], correctIndex: 2, explanation: "E3", concept: "Genes" }
      ]
    });
    quizId = quiz.id;
    questionIds = quiz.questions.map((question) => String(question._id));
  }, 180_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  }, 180_000);

  it("scores blank and partial attempts, then returns the same completed result on repeat submission", async () => {
    const publicQuiz = await request(app)
      .get(`/api/v1/materials/${materialId}/quizzes`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(publicQuiz.body.data[0].questions[0]).not.toHaveProperty("correctIndex");

    const blank = await request(app)
      .post(`/api/v1/quizzes/${quizId}/attempts`)
      .set("Authorization", `Bearer ${token}`);
    const blankResult = await request(app)
      .post(`/api/v1/attempts/${blank.body.data.id}/submit`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(blankResult.body.data).toMatchObject({ score: 0, correctCount: 0, total: 3 });

    const partial = await request(app)
      .post(`/api/v1/quizzes/${quizId}/attempts`)
      .set("Authorization", `Bearer ${token}`);
    await request(app)
      .patch(`/api/v1/attempts/${partial.body.data.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ answers: [{ questionId: questionIds[0], selectedIndex: 0 }] })
      .expect(200);
    const first = await request(app)
      .post(`/api/v1/attempts/${partial.body.data.id}/submit`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(first.body.data).toMatchObject({ score: 33, correctCount: 1, total: 3 });
    const repeated = await request(app)
      .post(`/api/v1/attempts/${partial.body.data.id}/submit`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(repeated.body.meta.idempotent).toBe(true);
    expect(repeated.body.data).toMatchObject({ score: 33, correctCount: 1, total: 3 });
  });
});
