export const RECENT_MESSAGE_LIMIT = 10;
const SUMMARY_LIMIT = 3_000;

type ContextMessage = { role: "user" | "assistant"; content?: string | null };

const clean = (value: string) => value.replace(/\s+/g, " ").trim();

/**
 * Keeps a durable, compact record of messages that have moved outside the
 * prompt window. This is deliberately deterministic: it does not spend an
 * extra AI request and it cannot introduce facts that were not in the chat.
 */
export function extendConversationSummary(existing: string, messages: ContextMessage[]) {
  const additions = messages
    .map((message) => {
      const content = clean(message.content ?? "");
      if (!content) return "";
      const speaker = message.role === "user" ? "Student" : "Tutor";
      return `${speaker}: ${content.slice(0, 420)}`;
    })
    .filter(Boolean);
  if (!additions.length) return existing;

  const combined = [clean(existing), ...additions].filter(Boolean).join("\n");
  return combined.length <= SUMMARY_LIMIT ? combined : combined.slice(-SUMMARY_LIMIT);
}
