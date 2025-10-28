import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

type Params = {
  params: {
    departmentId: string;
    versionId: string;
  };
};

const ParamsSchema = z.object({
  departmentId: z.string().min(1),
  versionId: z.string().min(1),
});

export async function GET(_request: Request, { params }: Params) {
  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "Invalid parameters" },
      { status: 400 }
    );
  }

  const { departmentId, versionId } = parsed.data;

  try {
    const record = await prisma.orgChartVersion.findFirst({
      where: { id: versionId, departmentId },
    });

    if (!record) {
      console.info("orgchart:versions:get:not_found", {
        departmentId,
        versionId,
      });
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Version not found" },
        { status: 404 }
      );
    }

    const size = Buffer.byteLength(JSON.stringify(record.data), "utf8");
    console.info("orgchart:versions:get", {
      departmentId,
      id: record.id,
      size,
    });

    return NextResponse.json({
      ...record,
      createdAt: record.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("orgchart:api", error);
    return NextResponse.json({ code: "ERR" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "Invalid parameters" },
      { status: 400 }
    );
  }

  const { departmentId, versionId } = parsed.data;

  try {
    const record = await prisma.orgChartVersion.findFirst({
      where: { id: versionId, departmentId },
    });

    if (!record) {
      console.info("orgchart:versions:delete:not_found", {
        departmentId,
        versionId,
      });
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Version not found" },
        { status: 404 }
      );
    }

    await prisma.orgChartVersion.delete({ where: { id: record.id } });

    console.info("orgchart:versions:delete", {
      departmentId,
      id: record.id,
      wasDefault: record.isDefault,
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("orgchart:api", error);
    return NextResponse.json({ code: "ERR" }, { status: 500 });
  }
}
