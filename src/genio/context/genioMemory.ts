export type GenioMemoryRole = "user" | "assistant" | "tool";

export type GenioMemoryMessage = {
  role: GenioMemoryRole;
  content: string;
};

const MAX_MEMORY_MESSAGES = 10;

export function getMemory(context: unknown): GenioMemoryMessage[] {
  if (!context || typeof context !== "object") {
    return [];
  }

  const maybeMemory = (context as { memory?: unknown }).memory;

  if (!Array.isArray(maybeMemory)) {
    return [];
  }

  return maybeMemory
    .filter((item): item is GenioMemoryMessage => {
      if (!item || typeof item !== "object") {
        return false;
      }

      const role = (item as { role?: unknown }).role;
      const content = (item as { content?: unknown }).content;

      return (
        (role === "user" || role === "assistant" || role === "tool") &&
        typeof content === "string"
      );
    })
    .slice(-MAX_MEMORY_MESSAGES);
}

export function updateMemory(
  context: Record<string, unknown>,
  ...messages: GenioMemoryMessage[]
): Record<string, unknown> {
  const nextMemory = [...getMemory(context), ...messages].slice(-MAX_MEMORY_MESSAGES);

  return {
    ...context,
    memory: nextMemory,
  };
}
