import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import {
  buildCompetencyGaps,
  buildOfficeCoverage,
  buildRegistrySummary,
  buildTrainingImplementationStatus,
} from "@/lib/training-summary";

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

function indicatorRow(label: string, target: number, actual: number) {
  const percent = target > 0 ? Math.round((actual / target) * 1000) / 10 : 0;
  return { indicator: label, target, actual, percentAccomplishment: percent };
}

export async function GET(req: Request, { params }: { params: { departmentId: string } }) {
  try {
    const { departmentId } = params;
    const access = await requireDepartmentOwner(departmentId);
    if (access.error) return access.error;

    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get("year")) || new Date().getFullYear();
    // allYears=1 removes the date window: counts cover every imported training
    // (useful for TNA-style "who has never been trained"), while targets stay per-year.
    const allYears = searchParams.get("allYears") === "1";
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
    const excludeEmployeeTypeIds = (searchParams.get("excludeEmployeeTypeIds") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const [trainings, employees, target] = await Promise.all([
      prismadb.training.findMany({
        where: {
          departmentId,
          ...(allYears ? {} : { dateStart: { gte: yearStart, lt: yearEnd } }),
          // Unmatched rows (no employee) have no type to check, so keep them counted.
          ...(excludeEmployeeTypeIds.length
            ? { OR: [{ employeeId: null }, { employee: { employeeTypeId: { notIn: excludeEmployeeTypeIds } } }] }
            : {}),
        },
      }),
      prismadb.employee.findMany({
        where: {
          departmentId,
          isArchived: false,
          ...(excludeEmployeeTypeIds.length ? { employeeTypeId: { notIn: excludeEmployeeTypeIds } } : {}),
        },
        select: { id: true, officeId: true, offices: { select: { name: true } } },
      }),
      prismadb.learningDevelopmentTarget.findUnique({
        where: { departmentId_year: { departmentId, year } },
      }),
    ]);

    const employeeRows = employees.map((e) => ({ id: e.id, officeId: e.officeId, officeName: e.offices?.name ?? "Unassigned" }));
    const totalActiveEmployees = employeeRows.length;

    const registry = buildRegistrySummary(trainings, totalActiveEmployees);
    const implementationStatus = buildTrainingImplementationStatus(trainings);
    const officeCoverage = buildOfficeCoverage(employeeRows, trainings);
    const competencyGaps = buildCompetencyGaps(trainings);

    const t = target ?? {
      targetEmployeesCoveredByTNA: 0,
      targetApprovedTrainingPrograms: 0,
      targetTrainingsConducted: 0,
      targetEmployeesTrained: 0,
      targetMandatoryTrainingsCompleted: 0,
      targetCompetencyGapsAddressed: 0,
      targetPostTrainingReports: 0,
      targetTrainingBudget: 0,
      actualEmployeesCoveredByTNA: 0,
      actualPostTrainingReports: 0,
      actualTrainingBudgetUtilized: 0,
    };

    const approvedTrainingProgramsActual = implementationStatus.length;
    const mandatoryTrainingsCompletedActual = registry.byIndicator["Mandatory Training"] ?? 0;
    const competencyGapsAddressedActual = competencyGaps.length;

    const sectionI = [
      indicatorRow("Employees Covered by Training Needs Assessment (TNA)", t.targetEmployeesCoveredByTNA, t.actualEmployeesCoveredByTNA),
      indicatorRow("Approved Training Programs", t.targetApprovedTrainingPrograms, approvedTrainingProgramsActual),
      indicatorRow("Trainings Conducted", t.targetTrainingsConducted, registry.totalTrainingsConducted),
      indicatorRow("Employees Trained", t.targetEmployeesTrained, registry.totalEmployeesTrained),
      indicatorRow("Mandatory Trainings Completed", t.targetMandatoryTrainingsCompleted, mandatoryTrainingsCompletedActual),
      indicatorRow("Competency Gaps Addressed", t.targetCompetencyGapsAddressed, competencyGapsAddressedActual),
      indicatorRow("Employees Completing Post-Training Reports", t.targetPostTrainingReports, t.actualPostTrainingReports),
      indicatorRow("Training Budget Utilized", t.targetTrainingBudget, t.actualTrainingBudgetUtilized),
    ];

    const employeeCoveragePercent = totalActiveEmployees > 0 ? Math.round((registry.employeesWithAtLeastOneTraining / totalActiveEmployees) * 1000) / 10 : 0;
    const targetCoveragePercent =
      totalActiveEmployees > 0 ? Math.round((t.targetEmployeesTrained / totalActiveEmployees) * 1000) / 10 : 0;

    const sectionV = [
      indicatorRow("Training Programs Implemented", t.targetApprovedTrainingPrograms, approvedTrainingProgramsActual),
      indicatorRow("Employee Training Coverage (%)", targetCoveragePercent, employeeCoveragePercent),
      indicatorRow("Mandatory Training Compliance", t.targetMandatoryTrainingsCompleted, mandatoryTrainingsCompletedActual),
      indicatorRow("Competency Gaps Addressed", t.targetCompetencyGapsAddressed, competencyGapsAddressedActual),
      indicatorRow("Utilization of Training Budget", t.targetTrainingBudget, t.actualTrainingBudgetUtilized),
    ];

    return NextResponse.json({
      year,
      totalActiveEmployees,
      registry,
      implementationStatus,
      officeCoverage,
      competencyGaps,
      target: t,
      sectionI,
      sectionV,
    });
  } catch (error) {
    console.error("[TRAINING_SUMMARY_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
