import {
  configToJson,
  patchExportTemplateBodySchema,
  toExportTemplateDto,
} from "@/lib/export-template-config";
import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: { departmentId: string; templateId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 401 });
    }
    if (!params.departmentId) {
      return new NextResponse("Department Id is required", { status: 400 });
    }
    if (!params.templateId) {
      return new NextResponse("Template Id is required", { status: 400 });
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

    const parsed = patchExportTemplateBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const existing = await prisma.employeeExportTemplate.findFirst({
      where: {
        id: params.templateId,
        departmentId: params.departmentId,
        userId,
      },
    });
    if (!existing) {
      return new NextResponse("Not found", { status: 404 });
    }

    const { name, description, config } = parsed.data;
    const row = await prisma.employeeExportTemplate.update({
      where: { id: existing.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(config !== undefined ? { config: configToJson(config) } : {}),
      },
    });

    return NextResponse.json(toExportTemplateDto(row));
  } catch (error) {
    console.log("[EXPORT_TEMPLATE_PATCH]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { departmentId: string; templateId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 401 });
    }
    if (!params.departmentId) {
      return new NextResponse("Department Id is required", { status: 400 });
    }
    if (!params.templateId) {
      return new NextResponse("Template Id is required", { status: 400 });
    }

    const department = await prisma.department.findFirst({
      where: { id: params.departmentId, userId },
      select: { id: true },
    });
    if (!department) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    const existing = await prisma.employeeExportTemplate.findFirst({
      where: {
        id: params.templateId,
        departmentId: params.departmentId,
        userId,
      },
      select: { id: true },
    });
    if (!existing) {
      return new NextResponse("Not found", { status: 404 });
    }

    await prisma.employeeExportTemplate.delete({
      where: { id: existing.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.log("[EXPORT_TEMPLATE_DELETE]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
