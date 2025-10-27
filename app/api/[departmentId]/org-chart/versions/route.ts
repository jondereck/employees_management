import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

type Params = {
  params: {
    departmentId: string;
  };
};

export const runtime = "nodejs";

const SaveSchema = z.object({
  label: z.string().min(1, "Label is required"),
  data: z
    .object({
      nodes: z.array(z.any()),
      edges: z.array(z.any()),
    })
    .passthrough(),
});

const ParamsSchema = z.object({
  departmentId: z.string().min(1),
});

export async function GET(_request: Request, { params }: Params) {
  const parseParams = ParamsSchema.safeParse(params);
  if (!parseParams.success) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "Invalid department id" },
      { status: 400 }
    );
  }

  const { departmentId } = parseParams.data;

  try {
    const versions = await prisma.orgChartVersion.findMany({
      where: { departmentId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        departmentId: true,
        label: true,
        createdAt: true,
        isDefault: true,
      },
    });

    console.info("orgchart:versions:list", {
      departmentId,
      count: versions.length,
    });

    return NextResponse.json(
      versions.map((version) => ({
        ...version,
        createdAt: version.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error("orgchart:api", error);
    return NextResponse.json({ code: "ERR" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: Params) {
  const parseParams = ParamsSchema.safeParse(params);
  if (!parseParams.success) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "Invalid department id" },
      { status: 400 }
    );
  }

  const { departmentId } = parseParams.data;

  let payload: z.infer<typeof SaveSchema>;
  try {
    const json = await request.json();
    const parsed = SaveSchema.safeParse(json);
    if (!parsed.success) {
      console.info("orgchart:versions:save:invalid", {
        departmentId,
        issues: parsed.error.issues.map((issue) => issue.message),
      });
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid payload" },
        { status: 400 }
      );
    }
    payload = parsed.data;
  } catch (error) {
    console.info("orgchart:versions:save:parse_error", {
      departmentId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { label, data } = payload;
  const jsonData = data as Prisma.InputJsonValue;
  const bodySize = Buffer.byteLength(JSON.stringify(jsonData), "utf8");

  try {
    console.info("orgchart:versions:save", {
      departmentId,
      label,
      size: bodySize,
    });

    const record = await prisma.orgChartVersion.create({
      data: {
        departmentId,
        label: label.trim(),
        data: jsonData,
      },
    });

    return NextResponse.json(
      {
        id: record.id,
        label: record.label,
        createdAt: record.createdAt.toISOString(),
        isDefault: record.isDefault,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("orgchart:api", error);
    return NextResponse.json({ code: "ERR" }, { status: 500 });
  }
}
