import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { openGenioContext, sealGenioContext } from "@/src/genio/context";
import { isGenioV1Enabled } from "@/src/genio/featureFlags";
import {
  buildContextFromStoredGenioResult,
  loadGenioResultContext,
  loadRecentGenioResultContext,
  saveGenioResultContext,
} from "@/src/genio/resultContext";
import { genioRequestSchema, runGenio, runGenioV1 } from "@/src/genio/service";
import { streamReply } from "@/src/genio/utils";

export async function POST(
  req: Request,
  { params }: { params: { departmentId: string } }
) {
  const startedAt = Date.now();
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 401 });
    }

    const department = await prismadb.department.findFirst({
      where: {
        id: params.departmentId,
        userId,
      },
      select: { id: true },
    });

    if (!department) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    const json: unknown = await req.json().catch(() => null);
    const parsed = genioRequestSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid Genio request." },
        { status: 400 }
      );
    }

    const scope = { departmentId: department.id, userId };
    const openedContext = openGenioContext(parsed.data.context, scope);
    const storedResultContext = await loadGenioResultContext({
      id: openedContext.resultContextId,
      departmentId: department.id,
      userId,
    }).catch((error) => {
      console.warn("[GENIO_CONTEXT_LOAD]", error);
      return null;
    });
    const fallbackRecentContext =
      !storedResultContext && !openedContext.resultContextId
        ? await loadRecentGenioResultContext({
            departmentId: department.id,
            userId,
          }).catch(() => null)
        : null;
    const restoredContext = buildContextFromStoredGenioResult(
      storedResultContext ?? fallbackRecentContext
    );
    const context = restoredContext
      ? {
          ...openedContext,
          ...restoredContext,
          lastResult: restoredContext.lastResult ?? openedContext.lastResult,
        }
      : openedContext;

    const v1Enabled = isGenioV1Enabled({ departmentId: department.id, userId });
    const v1Run = v1Enabled
      ? await runGenioV1({
          departmentId: department.id,
          message: parsed.data.message,
          context,
          clientMeta: parsed.data.clientMeta,
        })
      : null;
    const result =
      v1Run?.result ??
      (await runGenio({
        departmentId: department.id,
        message: parsed.data.message,
        context,
        clientMeta: parsed.data.clientMeta,
      }));

    if (result.kind === "file") {
      return result.response;
    }

    const nextStoredContext = await saveGenioResultContext({
      departmentId: department.id,
      userId,
      question: parsed.data.message,
      languageHint: parsed.data.clientMeta?.languageHint,
      localeHint: parsed.data.clientMeta?.locale,
      result,
    }).catch((error) => {
      console.warn("[GENIO_CONTEXT_SAVE]", error);
      return null;
    });
    const sealedContext = sealGenioContext(nextStoredContext ?? result.context, scope);
    if (v1Run?.decision) {
      console.info("[GENIO_V1_TELEMETRY]", {
        departmentId: department.id,
        userId,
        intent: v1Run.decision.intent,
        selectedTool: v1Run.decision.selectedTool,
        confidence: v1Run.decision.confidence,
        blockedReason: v1Run.decision.blockedReason ?? null,
        fallbackReason: v1Run.decision.fallbackReason ?? null,
        answerabilityClass: v1Run.decision.answerabilityClass,
        memoryUsed: v1Run.decision.memoryUsed,
        latencyMs: Date.now() - startedAt,
      });
    }
    return streamReply(
      result.reply,
      sealedContext,
      result.meta?.viewProfileEmployeeId ?? null,
      {
        canExport: result.meta?.canExport,
        metadata: result.meta?.metadata,
        routing: v1Run?.decision,
      }
    );
  } catch (error) {
    console.error("[GENIO_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
