import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

type Params = {
  params: {
    departmentId: string;
    versionId: string;
  };
};

export async function POST(_request: Request, { params }: Params) {
  const ParamsSchema = z.object({
    departmentId: z.string().min(1),
    versionId: z.string().min(1),
  });

  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "Invalid parameters" },
      { status: 400 }
    );
  }

  const { departmentId, versionId } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const target = await tx.orgChartVersion.findFirst({
        where: { id: versionId, departmentId },
      });

      if (!target) {
        return null;
      }

      await tx.orgChartVersion.updateMany({
        where: { departmentId, isDefault: true },
        data: { isDefault: false },
      });

      return tx.orgChartVersion.update({
        where: { id: target.id },
        data: { isDefault: true },
      });
    });

    if (!result) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Version not found" },
        { status: 404 }
      );
    }

    console.info("orgchart:versions:set_default", {
      departmentId,
      versionId: result.id,
    });

    return NextResponse.json({
      ...result,
      createdAt: result.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("orgchart:api", error);
    return NextResponse.json({ code: "ERR" }, { status: 500 });
  }
}

