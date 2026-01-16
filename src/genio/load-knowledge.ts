import fs from "fs";
import path from "path";

export async function loadGenioKnowledge() {
  const filePath = path.join(
    process.cwd(),
    "src",
    "genio",
    "knowledge",
    "employees_list.txt"
  );

  if (!fs.existsSync(filePath)) {
    throw new Error("Genio knowledge file not found");
  }

  return fs.readFileSync(filePath, "utf-8");
}



export function chunkText(text: string, size = 400) {
  const lines = text.split("\n").filter(Boolean);
  const chunks: string[] = [];

  let buffer = "";

  for (const line of lines) {
    if ((buffer + line).length > size) {
      chunks.push(buffer);
      buffer = line;
    } else {
      buffer += "\n" + line;
    }
  }

  if (buffer) chunks.push(buffer);

  return chunks;
}


export function retrieveRelevantKnowledge(
  chunks: string[],
  question: string,
  limit = 3
) {
  const keywords = question.toLowerCase().split(" ");

  return chunks
    .map((chunk) => {
      const score = keywords.filter((k) =>
        chunk.toLowerCase().includes(k)
      ).length;

      return { chunk, score };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((c) => c.chunk);
}
