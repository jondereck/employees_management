// src/genio/utils.ts


type FormatOptions = {
  style?: "bullet" | "numbered";
  showEmployeeNo?: boolean;
  showOffice?: boolean;
  showPosition?: boolean;
};

export function formatEmployees(
  employees: any[],
  options: FormatOptions = {}
) {
  const {
    style = "bullet",
    showEmployeeNo = false,
    showOffice = true,
    showPosition = false,
  } = options;

  return employees
    .map((e, i) => {
      const prefix = style === "numbered" ? `${i + 1}.` : "•";
      const office = e.offices?.name ?? "No office";

      let line = `${prefix} ${e.firstName} ${e.lastName}`;

      if (showEmployeeNo && e.employeeNo) {
        line += ` (${e.employeeNo})`;
      }

      if (showOffice) {
        line += ` — ${office}`;
      }

      if (showPosition && e.position) {
        line += `\n  🧑‍💼 ${e.position}`;
      }

      return line;
    })
    .join("\n");
}



export type GenioVisualStat = {
  label: string;
  value: number;
};

export type GenioVisualStats = {
  title: string;
  total?: number;
  items: GenioVisualStat[];
};

function parseCount(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeStatLabel(label: string) {
  return label
    .replace(/^[-*\d.\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractStats(text: string): GenioVisualStats | null {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const total =
    parseCount(text.match(/\bThere are\s+([\d,]+)\b/i)?.[1]) ??
    parseCount(text.match(/\bTotal:\s*([\d,]+)\b/i)?.[1]) ??
    parseCount(text.match(/\bfound:\s*([\d,]+)\b/i)?.[1]);

  const items: GenioVisualStat[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const bulletMatch =
      line.match(/^[-*]\s*(.+?):\s*([\d,]+)\b/i) ||
      line.match(/^\d+\.\s*(.+?):\s*([\d,]+)\b/i) ||
      line.match(/^[-*]\s*(.+?)\s+-\s*([\d,]+)\s+(?:employees?|awards?|records?|offices?)\b/i) ||
      line.match(/^\d+\.\s*(.+?)\s+-\s*([\d,]+)\s+(?:employees?|awards?|records?|offices?)\b/i);

    if (!bulletMatch) continue;

    const label = normalizeStatLabel(bulletMatch[1]);
    const value = parseCount(bulletMatch[2]);
    if (!label || value === undefined) continue;

    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ label, value });
  }

  const genderItems = [
    { label: "Male", value: parseCount(text.match(/\bMale:\s*([\d,]+)\b/i)?.[1]) },
    { label: "Female", value: parseCount(text.match(/\bFemale:\s*([\d,]+)\b/i)?.[1]) },
  ].filter((item): item is GenioVisualStat => item.value !== undefined);

  for (const item of genderItems) {
    if (!seen.has(item.label.toLowerCase())) {
      seen.add(item.label.toLowerCase());
      items.push(item);
    }
  }

  if (!total && items.length < 2) return null;

  const title = /distribution|breakdown/i.test(text)
    ? "Distribution"
    : /salary grade|SG\b/i.test(text)
    ? "Salary grade summary"
    : /office/i.test(text)
    ? "Office summary"
    : "HRIS summary";

  return {
    title,
    total,
    items: items.slice(0, 6),
  };
}

export function formatGenioMessage(text: string) {
  return text
    // normalize line spacing
    .replace(/\n{3,}/g, "\n\n")
    // bullet consistency
    .replace(/^•/gm, "-")
    // emphasize numbers
    .replace(/\*\*(\d+)\*\*/g, "**$1**");
}

export function removeVisualizedStats(text: string, stats: GenioVisualStats | null) {
  if (!stats) return text;

  const statLabels = new Set(stats.items.map((item) => item.label.toLowerCase()));
  const lines = text.split("\n");
  const kept = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;

    const labelValueMatch =
      trimmed.match(/^[-*]?\s*(.+?):\s*[\d,]+\b/i) ||
      trimmed.match(/^\d+\.\s*(.+?):\s*[\d,]+\b/i);

    if (labelValueMatch) {
      const label = normalizeStatLabel(labelValueMatch[1]).toLowerCase();
      if (statLabels.has(label) || label === "total") return false;
    }

    if (/^There are\s+[\d,]+\s+active employees\.?$/i.test(trimmed)) return false;
    if (/^Gender distribution:\s*$/i.test(trimmed)) return false;

    return true;
  });

  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function streamReply(
  reply: string,
  context: any,
  viewProfileEmployeeId?: string | null,
  meta?: {
    canExport?: boolean;
    metadata?: unknown;
    routing?: {
      intent?: string;
      selectedTool?: string;
      confidence: number;
      blockedReason?: string;
      fallbackReason?: string;
      memoryUsed: boolean;
      answerabilityClass: string;
    };
  }
) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of reply.split(/\n+/).filter(Boolean)) {
        controller.enqueue(encoder.encode(chunk + "\n"));
        await new Promise((r) => setTimeout(r, 30));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain",
      "x-genio-context": JSON.stringify(context),
      "x-genio-meta": JSON.stringify({
        ...(viewProfileEmployeeId ? { viewProfileEmployeeId } : {}),
        ...(meta?.canExport ? { canExport: true } : {}),
        ...(meta?.metadata ? { metadata: meta.metadata } : {}),
        ...(meta?.routing
          ? {
              intent: meta.routing.intent ?? null,
              selectedTool: meta.routing.selectedTool ?? null,
              confidence: meta.routing.confidence,
              blockedReason: meta.routing.blockedReason ?? null,
              fallbackReason: meta.routing.fallbackReason ?? null,
              memoryUsed: meta.routing.memoryUsed,
              answerabilityClass: meta.routing.answerabilityClass,
            }
          : {}),
      }),
    },
  });
}
