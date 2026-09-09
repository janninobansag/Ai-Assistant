import { app } from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";

async function start(): Promise<void> {
  try {
    await connectDatabase();
    const server = app.listen(env.API_PORT, () =>
      console.log(`Study API listening on http://localhost:${env.API_PORT}`)
    );
    const shutdown = async (signal: string) => {
      console.log(`${signal} received; shutting down`);
      server.close(async () => {
        await disconnectDatabase();
        process.exit(0);
      });
    };
    process.once("SIGINT", () => void shutdown("SIGINT"));
    process.once("SIGTERM", () => void shutdown("SIGTERM"));
  } catch (error) {
    console.error(
      "MongoDB connection failed. Check MONGODB_URI and ensure MongoDB is reachable.",
      error
    );
    process.exit(1);
  }
}

void start();
