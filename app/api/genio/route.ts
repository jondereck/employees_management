import { routeGenioMessage } from "@/src/genio/genioRouter";

export async function POST(req: Request) {
  const payload = (await req.json()) as {
    message?: unknown;
    context?: unknown;
  };

  return routeGenioMessage({
    message: typeof payload.message === "string" ? payload.message : "",
    context:
      payload.context && typeof payload.context === "object" && !Array.isArray(payload.context)
        ? (payload.context as Record<string, unknown>)
        : {},
  });
}
