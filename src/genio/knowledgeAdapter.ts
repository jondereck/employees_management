import { readFileSync } from "fs";
import { join } from "path";

type KnowledgeSnippet = {
  id: string;
  title: string;
  excerpt: string;
};

const KNOWLEDGE_FILES = [
  { id: "git-sync", path: "docs/git-sync.md", title: "Git Sync Guide" },
  { id: "mempalace-memory", path: "docs/mempalace-memory.md", title: "Project Memory Guide" },
] as const;

const DOMAIN_KEYWORDS: Record<string, RegExp> = {
  history_snapshot: /\b(history|snapshot|as of|workforce history)\b/i,
  award_analytics: /\b(award|recognition|parangal)\b/i,
  employment_event_lookup: /\b(event|promotion|promoted|transferred|terminated|hired)\b/i,
  schedule_metadata: /\b(schedule|rotation|weekly exclusion|exception)\b/i,
};

let cachedKnowledge: KnowledgeSnippet[] | null = null;

function loadKnowledge() {
  if (cachedKnowledge) return cachedKnowledge;

  cachedKnowledge = KNOWLEDGE_FILES.map((entry) => {
    try {
      const fullPath = join(process.cwd(), entry.path);
      const raw = readFileSync(fullPath, "utf8");
      const excerpt = raw.replace(/\s+/g, " ").trim().slice(0, 280);
      return { id: entry.id, title: entry.title, excerpt };
    } catch {
      return { id: entry.id, title: entry.title, excerpt: "" };
    }
  }).filter((item) => item.excerpt.length > 0);

  return cachedKnowledge;
}

export function getKnowledgeSnippet(message: string, selectedTool: string) {
  const knowledge = loadKnowledge();
  if (!knowledge.length) return null;

  const matcher = DOMAIN_KEYWORDS[selectedTool];
  if (!matcher || !matcher.test(message)) return null;

  return knowledge[0] ?? null;
}
