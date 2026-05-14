import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { openGenioContext, sealGenioContext } from "@/src/genio/context";
import {
  buildContextFromStoredGenioResult,
  loadGenioResultContext,
  saveGenioResultContext,
} from "@/src/genio/resultContext";
import { genioRequestSchema, runGenio } from "@/src/genio/service";
import { streamReply } from "@/src/genio/utils";

export async function POST(
  req: Request,
  { params }: { params: { departmentId: string } }
) {
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
    const restoredContext = buildContextFromStoredGenioResult(storedResultContext);
    const context = restoredContext
      ? {
          ...openedContext,
          ...restoredContext,
          lastResult: restoredContext.lastResult ?? openedContext.lastResult,
        }
      : openedContext;

    const result = await runGenio({
      departmentId: department.id,
      message: parsed.data.message,
      context,
    });

    if (result.kind === "file") {
      return result.response;
    }

    const nextStoredContext = await saveGenioResultContext({
      departmentId: department.id,
      userId,
      question: parsed.data.message,
      result,
    }).catch((error) => {
      console.warn("[GENIO_CONTEXT_SAVE]", error);
      return null;
    });
    const sealedContext = sealGenioContext(nextStoredContext ?? result.context, scope);
    return streamReply(
      result.reply,
      sealedContext,
      result.meta?.viewProfileEmployeeId ?? null,
      { canExport: result.meta?.canExport, metadata: result.meta?.metadata }
    );
  } catch (error) {
    console.error("[GENIO_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
