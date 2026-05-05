import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import {
  WORKFORCE_ACTIVE_STATUS,
  enhanceWorkforceSuggestionsWithAi,
  endOfReportYear,
  ensureDefaultWorkforceIndicators,
  suggestWorkforceIndicator,
} from "@/lib/workforce-history";

export async function GET(
  req: Request,
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

    const { searchParams } = new URL(req.url);
    const year = normalizeYear(searchParams.get("year"));
    const populationMode = searchParams.get("populationMode") === "all" ? "all" : "active";
    const cutoff = endOfReportYear(year);

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

    const suggestionEmployees = await loadSuggestionEmployees(params.departmentId, cutoff, populationMode);
    const baseSuggestions = suggestionEmployees.map((employee) => ({
      employeeId: employee.id,
      suggestion: suggestWorkforceIndicator({
        position: employee.position,
        officeName: employee.officeName,
        employeeTypeName: employee.employeeTypeName,
      }),
      position: employee.position,
      officeName: employee.officeName,
      employeeTypeName: employee.employeeTypeName,
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
        const suggestion = suggestWorkforceIndicator({
          position: employee.position,
          officeName: employee.offices?.name,
          employeeTypeName: employee.employeeType?.name,
        });

        return {
          id: employee.id,
          name: formatEmployeeName(employee.lastName, employee.firstName, employee.middleName),
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
      suggestionEmployees: suggestionEmployees.map((employee) => {
        const suggestion = aiOverrides.get(employee.id) ?? baseByEmployeeId.get(employee.id) ?? suggestWorkforceIndicator({
          position: employee.position,
          officeName: employee.officeName,
          employeeTypeName: employee.employeeTypeName,
        });

        return {
          id: employee.id,
          name: employee.name,
          position: employee.position,
          isArchived: employee.isArchived,
          officeId: employee.officeId,
          officeName: employee.officeName,
          employeeTypeId: employee.employeeTypeId,
          employeeTypeName: employee.employeeTypeName,
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

function normalizeYear(value: unknown) {
  const year = Number(value);
  const current = new Date().getFullYear();
  if (!Number.isFinite(year)) return current;
  return Math.min(current + 1, Math.max(1900, Math.trunc(year)));
}

function formatEmployeeName(lastName?: string | null, firstName?: string | null, middleName?: string | null) {
  return [lastName, firstName, middleName ? `${middleName[0]}.` : ""].filter(Boolean).join(", ");
}

async function loadSuggestionEmployees(
  departmentId: string,
  cutoff: Date,
  populationMode: "active" | "all"
) {
  const snapshots = await prismadb.employeeHistorySnapshot.findMany({
    where: {
      departmentId,
      effectiveAt: { lte: cutoff },
    },
    include: {
      employee: {
        select: {
          id: true,
          lastName: true,
          firstName: true,
          middleName: true,
          dateHired: true,
        },
      },
      office: { select: { id: true, name: true } },
      employeeType: { select: { id: true, name: true } },
    },
    orderBy: [{ employeeId: "asc" }, { effectiveAt: "desc" }, { createdAt: "desc" }],
  });

  const latest = new Map<string, (typeof snapshots)[number]>();
  for (const snapshot of snapshots) {
    if (snapshot.employee.dateHired > cutoff || snapshot.effectiveAt < snapshot.employee.dateHired) {
      continue;
    }

    if (!latest.has(snapshot.employeeId)) {
      latest.set(snapshot.employeeId, snapshot);
    }
  }

  return Array.from(latest.values())
    .filter((snapshot) => (populationMode === "active" ? snapshot.status === WORKFORCE_ACTIVE_STATUS : true))
    .map((snapshot) => ({
      id: snapshot.employeeId,
      name: formatEmployeeName(snapshot.employee.lastName, snapshot.employee.firstName, snapshot.employee.middleName),
      position: snapshot.position,
      isArchived: snapshot.status !== WORKFORCE_ACTIVE_STATUS,
      officeId: snapshot.officeId ?? "",
      officeName: snapshot.office?.name ?? "",
      employeeTypeId: snapshot.employeeTypeId ?? "",
      employeeTypeName: snapshot.employeeType?.name ?? "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
