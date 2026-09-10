import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { app } from "../../app.js";
import { adminEmails } from "../../config/env.js";
import { User } from "../../models/user.js";
import { Subject } from "../../models/subject.js";

describe("administrator user management", () => {
  let mongo: MongoMemoryServer;
  let adminToken = "";
  let targetToken = "";
  let targetId = "";
  const adminEmail = "admin@example.com";
  const targetEmail = "learner@example.com";

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri("admin-test"));
    adminEmails.add(adminEmail);
    const admin = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: adminEmail, password: "secure-password", displayName: "Administrator" })
      .expect(201);
    adminToken = admin.body.data.accessToken;
    const target = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: targetEmail, password: "secure-password", displayName: "Learner" })
      .expect(201);
    targetToken = target.body.data.accessToken;
    targetId = target.body.data.user.id;
  });

  afterAll(async () => {
    adminEmails.delete(adminEmail);
    await mongoose.disconnect();
    await mongo.stop();
  });

  it("allows only an administrator to list users and reset a password", async () => {
    await request(app)
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${targetToken}`)
      .expect(403);
    const users = await request(app)
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(users.body.data.map((account: { email: string }) => account.email)).toContain(
      targetEmail
    );

    await request(app)
      .patch(`/api/v1/admin/users/${targetId}/password`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ password: "new-secure-password" })
      .expect(200);
    await request(app)
      .post("/api/v1/auth/login")
      .send({ email: targetEmail, password: "secure-password" })
      .expect(401);
    await request(app)
      .post("/api/v1/auth/login")
      .send({ email: targetEmail, password: "new-secure-password" })
      .expect(200);
  });

  it("requires an exact confirmation and permanently removes a user's data", async () => {
    await request(app)
      .post("/api/v1/subjects")
      .set("Authorization", `Bearer ${targetToken}`)
      .send({ name: "Disposable subject" })
      .expect(201);
    await request(app)
      .delete(`/api/v1/admin/users/${targetId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ confirmation: "DELETE learner" })
      .expect(400);
    await request(app)
      .delete(`/api/v1/admin/users/${targetId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ confirmation: `DELETE ${targetEmail}` })
      .expect(204);
    expect(await User.exists({ _id: targetId })).toBeNull();
    expect(await Subject.countDocuments({ userId: targetId })).toBe(0);
    await request(app)
      .get("/api/v1/subjects")
      .set("Authorization", `Bearer ${targetToken}`)
      .expect(401);
  });
});
