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
      "x-genio-context": JSON.stringify(context),
      "x-genio-meta": JSON.stringify({
        ...(viewProfileEmployeeId && { viewProfileEmployeeId }),
        ...(meta?.canExport && { canExport: true }),
      }),
    },
  });
}
