import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import {
  enhanceWorkforceSuggestionsWithAi,
  ensureDefaultWorkforceIndicators,
  suggestWorkforceIndicator,
} from "@/lib/workforce-history";

export async function GET(
  _req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) return new NextResponse("Unauthenticated", { status: 401 });

    const department = await prismadb.department.findFirst({
      where: { id: params.departmentId, userId },
      select: { id: true },
    });
    if (!department) return new NextResponse("Unauthorized", { status: 403 });
    await ensureDefaultWorkforceIndicators(params.departmentId);

    const [offices, employeeTypes, eligibilities, employees] = await Promise.all([
      prismadb.offices.findMany({
        where: { departmentId: params.departmentId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prismadb.employeeType.findMany({
        where: { departmentId: params.departmentId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prismadb.eligibility.findMany({
        where: { departmentId: params.departmentId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prismadb.employee.findMany({
        where: { departmentId: params.departmentId },
        select: {
          id: true,
          lastName: true,
          firstName: true,
          middleName: true,
          position: true,
          isArchived: true,
          officeId: true,
          employeeTypeId: true,
          offices: { select: { id: true, name: true } },
          employeeType: { select: { id: true, name: true } },
        },
        orderBy: [{ isArchived: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
      }),
    ]);

    const baseSuggestions = employees.map((employee) => ({
      employeeId: employee.id,
      suggestion: suggestWorkforceIndicator({
        position: employee.position,
        officeName: employee.offices?.name,
        employeeTypeName: employee.employeeType?.name,
      }),
      position: employee.position,
      officeName: employee.offices?.name,
      employeeTypeName: employee.employeeType?.name,
    }));

    const baseByEmployeeId = new Map(baseSuggestions.map((entry) => [entry.employeeId, entry.suggestion]));

    const aiCandidates = baseSuggestions
      .filter((entry) => entry.suggestion.confidence === "low")
      .map((entry) => ({
        employeeId: entry.employeeId,
        position: entry.position,
        officeName: entry.officeName,
        employeeTypeName: entry.employeeTypeName,
      }));

    const aiOverrides = await enhanceWorkforceSuggestionsWithAi(aiCandidates);

    return NextResponse.json({
      offices,
      employeeTypes,
      eligibilities,
      employees: employees.map((employee) => {
        const suggestion = aiOverrides.get(employee.id) ?? baseByEmployeeId.get(employee.id) ?? suggestWorkforceIndicator({
          position: employee.position,
          officeName: employee.offices?.name,
          employeeTypeName: employee.employeeType?.name,
        });

        return {
          id: employee.id,
          name: [employee.lastName, employee.firstName, employee.middleName ? `${employee.middleName[0]}.` : ""]
            .filter(Boolean)
            .join(", "),
          position: employee.position,
          isArchived: employee.isArchived,
          officeId: employee.officeId,
          officeName: employee.offices?.name ?? "",
          employeeTypeId: employee.employeeTypeId,
          employeeTypeName: employee.employeeType?.name ?? "",
          suggestedIndicatorName: suggestion.indicatorName,
          suggestionConfidence: suggestion.confidence,
          suggestionReason: suggestion.reason,
        };
      }),
    });
  } catch (error) {
    console.error("[WORKFORCE_HISTORY_OPTIONS_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
