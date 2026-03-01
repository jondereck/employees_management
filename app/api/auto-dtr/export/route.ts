import { NextResponse } from "next/server";

import type { DTRPreview } from "@/types/autoDtr";

type ExportPayload = {
  preview: DTRPreview;
  format: "single" | "zip";
};

export async function POST(request: Request) {
  const payload = (await request.json()) as ExportPayload;
  const { format } = payload;
  const data = new TextEncoder().encode(`Auto DTR export (${format}) generated at ${new Date().toISOString()}`);
  return new NextResponse(data, {
    headers: {
      "Content-Type": format === "zip" ? "application/zip" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="auto-dtr.${format === "zip" ? "zip" : "xlsx"}"`,
    },
  });
}
