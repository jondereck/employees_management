import {
  createExportTemplateBodySchema,
  configToJson,
  toExportTemplateDto,
} from "@/lib/export-template-config";
import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 401 });
    }
    if (!params.departmentId) {
      return new NextResponse("Department Id is required", { status: 400 });
    }

    const department = await prisma.department.findFirst({
      where: { id: params.departmentId, userId },
      select: { id: true },
    });
    if (!department) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    const rows = await prisma.employeeExportTemplate.findMany({
      where: { departmentId: params.departmentId, userId },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ items: rows.map(toExportTemplateDto) });
  } catch (error) {
    console.log("[EXPORT_TEMPLATES_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 401 });
    }
    if (!params.departmentId) {
      return new NextResponse("Department Id is required", { status: 400 });
    }

    const department = await prisma.department.findFirst({
      where: { id: params.departmentId, userId },
      select: { id: true },
    });
    if (!department) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = createExportTemplateBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { name, description, config } = parsed.data;
    const row = await prisma.employeeExportTemplate.create({
      data: {
        departmentId: params.departmentId,
        userId,
        name,
        description: description ?? null,
        config: configToJson(config),
      },
    });

    return NextResponse.json(toExportTemplateDto(row), { status: 201 });
  } catch (error) {
    console.log("[EXPORT_TEMPLATES_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
