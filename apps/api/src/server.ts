import { app } from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";

async function start(): Promise<void> {
  try {
    await connectDatabase();
    const port = env.PORT ?? env.API_PORT;
    const server = app.listen(port, "0.0.0.0", () =>
      console.log(`Study API listening on http://localhost:${port}`)
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
      "MongoDB connection failed. Retrying in 5 seconds. Check MONGODB_URI and ensure MongoDB is reachable.",
      error
    );
    setTimeout(() => void start(), 5_000);
  }
}

void start();
