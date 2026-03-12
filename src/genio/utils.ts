// src/genio/utils.ts



const MAX_CONTEXT_HEADER_BYTES = 6_000;

function createHeaderSafeContext(context: unknown) {
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    return {};
  }

  const base = { ...(context as Record<string, unknown>) };

  const memory = base.memory;
  if (Array.isArray(memory)) {
    base.memory = memory
      .filter((item): item is { role: string; content: string } =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as { role?: unknown }).role === "string" &&
        typeof (item as { content?: unknown }).content === "string"
      )
      .slice(-8)
      .map((item) => ({
        role: item.role,
        content: item.content.slice(0, 220),
      }));
  }

  if (
    base.lastCountQuery &&
    typeof base.lastCountQuery === "object" &&
    !Array.isArray(base.lastCountQuery)
  ) {
    const lastCountQuery = { ...(base.lastCountQuery as Record<string, unknown>) };
    if ("where" in lastCountQuery) {
      delete lastCountQuery.where;
    }
    base.lastCountQuery = lastCountQuery;
  }

  if (
    base.lastListQuery &&
    typeof base.lastListQuery === "object" &&
    !Array.isArray(base.lastListQuery)
  ) {
    const lastListQuery = { ...(base.lastListQuery as Record<string, unknown>) };
    if ("where" in lastListQuery) {
      delete lastListQuery.where;
    }
    base.lastListQuery = lastListQuery;
  }

  let serialized = JSON.stringify(base);

  if (serialized.length > MAX_CONTEXT_HEADER_BYTES) {
    delete base.memory;
    serialized = JSON.stringify(base);
  }

  if (serialized.length > MAX_CONTEXT_HEADER_BYTES) {
    return {};
  }

  return base;
}

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



export function extractStats(text: string) {
  const total = text.match(/There are \*\*(\d+)/i)?.[1];

  const male = text.match(/\*\*(\d+)\s+male/i)?.[1];
  const female = text.match(/\*\*(\d+)\s+female/i)?.[1];

  if (!total && !male && !female) return null;

  return { total, male, female };
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

export function streamReply(
  reply: string,
  context: any,
  viewProfileEmployeeId?: string | null,
  meta?: {
    canExport?: boolean;
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
      "x-genio-context": JSON.stringify(createHeaderSafeContext(context)),
      "x-genio-meta": JSON.stringify({
        ...(viewProfileEmployeeId && { viewProfileEmployeeId }),
        ...(meta?.canExport && { canExport: true }),
      }),
    },
  });
}
