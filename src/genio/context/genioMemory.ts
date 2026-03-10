export type GenioMemoryRole = "user" | "assistant" | "tool";

export type GenioMemoryMessage = {
  role: GenioMemoryRole;
  content: string;
};

const MAX_MEMORY_MESSAGES = 10;
const memory: GenioMemoryMessage[] = [];

export function addGenioMemory(message: GenioMemoryMessage): void {
  memory.push(message);

  if (memory.length > MAX_MEMORY_MESSAGES) {
    memory.splice(0, memory.length - MAX_MEMORY_MESSAGES);
  }
}

export function getGenioMemory(): GenioMemoryMessage[] {
  return [...memory];
}
