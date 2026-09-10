import { env } from "../../config/env.js";

let failures = 0;
let openUntil = 0;

export async function hostedFetch(input: RequestInfo | URL, init: RequestInit) {
  if (Date.now() < openUntil) throw new Error("AI provider is temporarily unavailable. Please try again shortly.");
  try {
    const response = await fetch(input, init);
    if (!response.ok) throw new Error(`Hosted AI request failed (${response.status}).`);
    failures = 0;
    return response;
  } catch (error) {
    // A user stopping a streamed reply is expected and must not trip the breaker.
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    failures += 1;
    if (failures >= env.AI_CIRCUIT_BREAKER_FAILURES) openUntil = Date.now() + env.AI_CIRCUIT_BREAKER_COOLDOWN_SECONDS * 1_000;
    throw error;
  }
}
