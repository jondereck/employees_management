import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { openGenioContext, sealGenioContext } from "@/src/genio/context";
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
    const context = openGenioContext(parsed.data.context, scope);

    const result = await runGenio({
      departmentId: department.id,
      message: parsed.data.message,
      context,
    });

    if (result.kind === "file") {
      return result.response;
    }

    const sealedContext = sealGenioContext(result.context, scope);
    return streamReply(
      result.reply,
      sealedContext,
      result.meta?.viewProfileEmployeeId ?? null,
      { canExport: result.meta?.canExport }
    );
  } catch (error) {
    console.error("[GENIO_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

