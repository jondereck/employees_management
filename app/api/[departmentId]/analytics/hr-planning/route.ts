import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import {
  ageAt,
  buildAgeGroups,
  buildEducationDistribution,
  buildOfficeDistribution,
  buildPersonnelComplement,
  buildRetirementForecast,
  classifyEducation,
  getAgeGroupLabel,
  type HrPlanningEmployee,
} from "@/lib/hr-planning";
import { isEmployedAsOf, parseEmployeeTerminationDate } from "@/lib/workforce-history";

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

function formatName(e: {
  lastName: string;
  firstName: string;
  middleName?: string | null;
  suffix?: string | null;
}) {
  const mi = e.middleName?.trim() ? ` ${e.middleName.trim().charAt(0).toUpperCase()}.` : "";
  const suffix = e.suffix?.trim() ? ` ${e.suffix.trim()}` : "";
  return `${e.lastName}, ${e.firstName}${mi}${suffix}`;
}

function toAuditRow(e: {
  id: string;
  lastName: string;
  firstName: string;
  middleName?: string | null;
  suffix?: string | null;
  position: string;
  terminateDate: string;
  isArchived: boolean;
  gender: string;
  birthday: Date;
  education: string | null;
  employeeType: { name: string } | null;
  offices: { id: string; name: string } | null;
}, asOf: Date) {
  const age = ageAt(e.birthday, asOf);
  const employeeTypeName = e.employeeType?.name ?? "Unassigned";
  return {
    id: e.id,
    name: formatName(e),
    gender: e.gender as "Male" | "Female",
    position: e.position || "",
    officeName: e.offices?.name ?? "Unassigned",
    employeeTypeName,
    educationRaw: e.education || "",
    educationCategory: classifyEducation(e.education || ""),
    age,
    ageGroup: getAgeGroupLabel(age),
    birthday: e.birthday.toISOString(),
    terminateDate: (e.terminateDate || "").trim(),
    isArchived: e.isArchived,
  };
}

export async function GET(req: Request, { params }: { params: { departmentId: string } }) {
  try {
    const { departmentId } = params;
    const access = await requireDepartmentOwner(departmentId);
    if (access.error) return access.error;

    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get("year")) || new Date().getFullYear();
    // Snapshot as of end of the reporting calendar year.
    const asOf = new Date(year, 11, 31, 23, 59, 59, 999);

    const employees = await prismadb.employee.findMany({
      where: { departmentId },
      select: {
        id: true,
        gender: true,
        birthday: true,
        education: true,
        terminateDate: true,
        isArchived: true,
        position: true,
        firstName: true,
        lastName: true,
        middleName: true,
        suffix: true,
        employeeType: { select: { name: true } },
        offices: { select: { id: true, name: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    const notArchived = employees.filter((e) => !e.isArchived);
    const eligible = notArchived.filter((e) => isEmployedAsOf(e.terminateDate, asOf));

    const rows: HrPlanningEmployee[] = eligible.map((e) => ({
      gender: e.gender,
      birthday: e.birthday,
      education: e.education || "",
      employeeTypeName: e.employeeType?.name ?? "Unassigned",
      officeId: e.offices?.id ?? "",
      officeName: e.offices?.name ?? "Unassigned",
    }));

    const drilldownEmployees = eligible.map((e) => toAuditRow(e, asOf));

    // Archived but no terminate date — incomplete archive records.
    const archivedWithoutTerminateDate = employees
      .filter((e) => e.isArchived && !(e.terminateDate || "").trim())
      .map((e) => toAuditRow(e, asOf));

    // Not archived but terminated as of CY year-end — explains Eligible vs non-archived headcount.
    const notArchivedButTerminated = notArchived
      .filter((e) => {
        const termination = parseEmployeeTerminationDate(e.terminateDate);
        return Boolean(termination) && !isEmployedAsOf(e.terminateDate, asOf);
      })
      .map((e) => toAuditRow(e, asOf));

    return NextResponse.json({
      year,
      generatedAt: new Date().toISOString(),
      asOf: asOf.toISOString(),
      totalActiveEmployees: rows.length,
      totalNotArchived: notArchived.length,
      personnelComplement: buildPersonnelComplement(rows),
      officeDistribution: buildOfficeDistribution(rows),
      ageGroups: buildAgeGroups(rows, asOf),
      educationDistribution: buildEducationDistribution(rows),
      retirementForecast: buildRetirementForecast(rows, asOf),
      employees: drilldownEmployees,
      archivedWithoutTerminateDate,
      notArchivedButTerminated,
    });
  } catch (error) {
    console.error("[HR_PLANNING_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
