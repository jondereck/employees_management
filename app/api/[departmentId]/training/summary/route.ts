import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { resolveIncludedEmployeeTypeIds } from "@/lib/training-employee-type-filter";
import {
  buildCompetencyGaps,
  buildCoverageEmployeeLists,
  buildOfficeCoverage,
  buildRegistrySummary,
  buildTrainingImplementationStatus,
} from "@/lib/training-summary";
import { isEmployedAsOf } from "@/lib/workforce-history";

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

    // Coverage / "no training" uses currently employed staff. For a single year,
    // treat year-end as the cutoff; for all-years TNA views, use "as of today".
    const employedAsOf = allYears ? new Date() : new Date(yearEnd.getTime() - 1);

    const allTypes = await prismadb.employeeType.findMany({
      where: { departmentId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    const includedTypeIds = resolveIncludedEmployeeTypeIds(
      allTypes.map((t) => t.id),
      excludeEmployeeTypeIds
    );
    // When every type is excluded, eligible pool is empty.
    const employeeTypeFilter =
      includedTypeIds === null
        ? {}
        : { employeeTypeId: { in: includedTypeIds } };
    const trainingEmployeeTypeFilter =
      includedTypeIds === null
        ? null
        : {
            OR: [{ employeeId: null }, { employee: { employeeTypeId: { in: includedTypeIds } } }],
          };

    const [trainings, employees, target] = await Promise.all([
      prismadb.training.findMany({
        where: {
          departmentId,
          ...(allYears ? {} : { dateStart: { gte: yearStart, lt: yearEnd } }),
          AND: [
            // Unmatched rows (no employee) have no type to check, so keep them counted.
            // Skip trainings linked to archived employees for cleaner conducted totals.
            ...(trainingEmployeeTypeFilter ? [trainingEmployeeTypeFilter] : []),
            { OR: [{ employeeId: null }, { employee: { isArchived: false } }] },
          ],
        },
      }),
      prismadb.employee.findMany({
        where: {
          departmentId,
          isArchived: false,
          ...employeeTypeFilter,
        },
        select: {
          id: true,
          officeId: true,
          terminateDate: true,
          firstName: true,
          lastName: true,
          middleName: true,
          suffix: true,
          position: true,
          offices: { select: { name: true } },
          employeeType: { select: { id: true, name: true } },
        },
      }),
      prismadb.learningDevelopmentTarget.findUnique({
        where: { departmentId_year: { departmentId, year } },
      }),
    ]);

    const eligibleEmployees = employees
      .filter((e) => isEmployedAsOf(e.terminateDate, employedAsOf))
      .map((e) => ({
        id: e.id,
        officeId: e.officeId,
        officeName: e.offices?.name ?? "Unassigned",
        firstName: e.firstName,
        lastName: e.lastName,
        middleName: e.middleName,
        suffix: e.suffix,
        position: e.position,
        employeeTypeName: e.employeeType?.name ?? "Unassigned",
      }));
    const employeeRows = eligibleEmployees.map((e) => ({
      id: e.id,
      officeId: e.officeId,
      officeName: e.officeName,
    }));
    const totalActiveEmployees = employeeRows.length;
    const eligibleEmployeeIds = new Set(employeeRows.map((e) => e.id));

    const registry = buildRegistrySummary(trainings, totalActiveEmployees, eligibleEmployeeIds);
    const { withTraining: employeesWithTraining, withNoTraining: employeesWithNoTraining } = buildCoverageEmployeeLists(
      eligibleEmployees,
      trainings,
      eligibleEmployeeIds
    );
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

    const includedTypeNames =
      includedTypeIds === null
        ? allTypes.map((t) => t.name)
        : allTypes.filter((t) => includedTypeIds.includes(t.id)).map((t) => t.name);

    return NextResponse.json({
      year,
      totalActiveEmployees,
      includedEmployeeTypes: includedTypeNames,
      registry,
      employeesWithTraining,
      employeesWithNoTraining,
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
