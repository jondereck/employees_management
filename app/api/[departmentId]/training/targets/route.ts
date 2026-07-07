import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import prismadb from "@/lib/prismadb";

async function requireDepartmentOwner(departmentId: string) {
  const { userId } = auth();
  if (!userId) return { error: new NextResponse("Unauthenticated", { status: 401 }) };

  const department = await prismadb.department.findFirst({
    where: { id: departmentId, userId },
    select: { id: true },
  });
  if (!department) return { error: new NextResponse("Unauthorized", { status: 403 }) };

  return { department };
}

export async function GET(req: Request, { params }: { params: { departmentId: string } }) {
  try {
    const { departmentId } = params;
    const access = await requireDepartmentOwner(departmentId);
    if (access.error) return access.error;

    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get("year")) || new Date().getFullYear();

    const target = await prismadb.learningDevelopmentTarget.findUnique({
      where: { departmentId_year: { departmentId, year } },
    });

    return NextResponse.json({ target });
  } catch (error) {
    console.error("[TRAINING_TARGETS_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

const Payload = z.object({
  year: z.number().int(),
  targetEmployeesCoveredByTNA: z.number().int().min(0).default(0),
  targetApprovedTrainingPrograms: z.number().int().min(0).default(0),
  targetTrainingsConducted: z.number().int().min(0).default(0),
  targetEmployeesTrained: z.number().int().min(0).default(0),
  targetMandatoryTrainingsCompleted: z.number().int().min(0).default(0),
  targetCompetencyGapsAddressed: z.number().int().min(0).default(0),
  targetPostTrainingReports: z.number().int().min(0).default(0),
  targetTrainingBudget: z.number().min(0).default(0),
  actualEmployeesCoveredByTNA: z.number().int().min(0).default(0),
  actualPostTrainingReports: z.number().int().min(0).default(0),
  actualTrainingBudgetUtilized: z.number().min(0).default(0),
});

export async function PUT(req: Request, { params }: { params: { departmentId: string } }) {
  try {
    const { departmentId } = params;
    const access = await requireDepartmentOwner(departmentId);
    if (access.error) return access.error;

    const body = await req.json().catch(() => null);
    const parsed = Payload.safeParse(body);
    if (!parsed.success) {
      return new NextResponse("Invalid payload", { status: 400 });
    }

    const { year, ...data } = parsed.data;

    const target = await prismadb.learningDevelopmentTarget.upsert({
      where: { departmentId_year: { departmentId, year } },
      create: { departmentId, year, ...data },
      update: data,
    });

    return NextResponse.json({ target });
  } catch (error) {
    console.error("[TRAINING_TARGETS_PUT]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
