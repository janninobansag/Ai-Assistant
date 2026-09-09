import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { app } from "./app.js";

let mongo: MongoMemoryServer;
let userToken = "";
let userRefreshCookie = "";
let subjectId = "";

describe("Phase 1 API integration", () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri("study-test"));
  }, 180_000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
  }, 180_000);

  it("registers, persists a session, and rotates refresh tokens", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "phase1@example.com", password: "secure-password", displayName: "Phase One" })
      .expect(201);
    userToken = response.body.data.accessToken;
    userRefreshCookie = response.headers["set-cookie"]?.[0] ?? "";
    expect(userRefreshCookie).toContain("refreshToken=");
    const refreshed = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", userRefreshCookie)
      .expect(200);
    expect(refreshed.body.data.accessToken).toBeTruthy();
    expect(refreshed.headers["set-cookie"]?.[0] ?? "").toContain("refreshToken=");
  });

  it("isolates subject access by owner and supports logout-all", async () => {
    const created = await request(app)
      .post("/api/v1/subjects")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ name: "Biology" })
      .expect(201);
    subjectId = created.body.data._id;
    const other = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "other@example.com", password: "secure-password", displayName: "Other" })
      .expect(201);
    await request(app)
      .get(`/api/v1/subjects/${subjectId}`)
      .set("Authorization", `Bearer ${other.body.data.accessToken}`)
      .expect(404);
    await request(app)
      .post("/api/v1/auth/logout-all")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(204);
    await request(app).post("/api/v1/auth/refresh").set("Cookie", userRefreshCookie).expect(401);
  });
});
