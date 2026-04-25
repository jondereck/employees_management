import { routeGenioMessage } from "@/src/genio/genioRouter";

export async function POST(req: Request) {
  const body = (await req.json()) as { message?: unknown; context?: unknown };
  return routeGenioMessage(body.message, body.context);
}
