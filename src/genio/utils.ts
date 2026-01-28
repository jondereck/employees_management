// src/genio/utils.ts


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
      for (const chunk of reply.match(/[^.!?]+[.!?]+/g) ?? [reply]) {
        controller.enqueue(encoder.encode(chunk));
        await new Promise((r) => setTimeout(r, 50));
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
