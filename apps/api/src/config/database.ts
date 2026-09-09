import mongoose from "mongoose";
import { env } from "./env.js";

let connectPromise: Promise<typeof mongoose> | undefined;

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function connectDatabase(): Promise<typeof mongoose> {
  if (isDatabaseReady()) return mongoose;
  connectPromise ??= mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5_000,
    maxPoolSize: 10
  });
  try {
    await connectPromise;
    console.log("MongoDB connected");
    return mongoose;
  } catch (error) {
    connectPromise = undefined;
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  connectPromise = undefined;
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
