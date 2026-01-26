// src/genio/utils.ts
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
