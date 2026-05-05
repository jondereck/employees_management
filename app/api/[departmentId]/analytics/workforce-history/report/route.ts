import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import {
  buildWorkforceReportGroupHash,
  getWorkforceReportCache,
  WORKFORCE_ACTIVE_STATUS,
  WORKFORCE_DIMENSIONS,
  WORKFORCE_OTHERS_INDICATOR,
  WORKFORCE_REPORT_CACHE_VERSION,
  endOfReportYear,
  ensureDefaultWorkforceIndicators,
  type WorkforceDimension,
  type WorkforcePopulationMode,
  upsertWorkforceReportCache,
} from "@/lib/workforce-history";

type SnapshotForReport = Awaited<ReturnType<typeof loadLatestSnapshots>>[number];

function normalizeYear(value: unknown) {
  const year = Number(value);
  const latest = Math.max(1900, new Date().getFullYear() - 1);
  if (!Number.isFinite(year)) return latest;
  return Math.min(latest, Math.max(1900, Math.trunc(year)));
}

function normalizePopulationMode(value: unknown): WorkforcePopulationMode {
  return value === "all" ? "all" : "active";
}

function normalizeDimension(value: unknown): WorkforceDimension {
  return WORKFORCE_DIMENSIONS.includes(value as WorkforceDimension)
    ? (value as WorkforceDimension)
    : "employeeType";
}

function normalizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0).map((value) => value.trim()))
  );
}

async function requireDepartmentOwner(departmentId: string) {
  const { userId } = auth();
  if (!userId) return { error: new NextResponse("Unauthenticated", { status: 401 }) };

  const department = await prismadb.department.findFirst({
    where: { id: departmentId, userId },
    select: { id: true, name: true },
  });
  if (!department) return { error: new NextResponse("Unauthorized", { status: 403 }) };

  return { department };
}

async function loadLatestSnapshots(departmentId: string, cutoff: Date) {
  const snapshots = await prismadb.employeeHistorySnapshot.findMany({
    where: {
      departmentId,
      effectiveAt: { lte: cutoff },
    },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, dateHired: true } },
      office: { select: { id: true, name: true } },
      employeeType: { select: { id: true, name: true } },
      eligibility: { select: { id: true, name: true } },
      indicator: { select: { id: true, name: true } },
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

  return Array.from(latest.values());
}

function getDimensionValue(snapshot: SnapshotForReport, dimension: WorkforceDimension) {
  switch (dimension) {
    case "employeeType":
      return snapshot.employeeType?.name || "Unknown";
    case "gender":
      return snapshot.gender || "Unknown";
    case "maritalStatus":
      return snapshot.maritalStatus || "Unknown";
    case "eligibility":
      return snapshot.eligibility?.name || "Unknown";
    case "office":
      return snapshot.office?.name || "Unknown";
    case "position":
      return snapshot.position?.trim() || "Unknown";
    case "status":
      return snapshot.status === WORKFORCE_ACTIVE_STATUS ? "Active" : "Inactive";
    case "headStatus":
      return snapshot.isHead ? "Head" : "Non-head";
    default:
      return "Unknown";
  }
}

export async function POST(
  req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    const access = await requireDepartmentOwner(params.departmentId);
    if (access.error) return access.error;

    const body = await req.json().catch(() => ({}));
    const year = normalizeYear(body?.year);
    const populationMode = normalizePopulationMode(body?.populationMode);
    const dimension = normalizeDimension(body?.dimension ?? body?.dimensions?.[0]);
    const groupIds = normalizeStringArray(body?.groupIds);
    const cutoff = endOfReportYear(year);
    const selectedGroupHash = buildWorkforceReportGroupHash(groupIds);
    await ensureDefaultWorkforceIndicators(params.departmentId);

    const cached = await getWorkforceReportCache(
      params.departmentId,
      year,
      populationMode,
      dimension,
      selectedGroupHash
    );

    if (cached?.payload) {
      const payload = cached.payload as Record<string, unknown>;
      return NextResponse.json({
        ...payload,
        meta: {
          ...(payload.meta as Record<string, unknown> | undefined),
          cacheStatus: "hit",
          cacheGeneratedAt: cached.generatedAt?.toISOString?.() ?? null,
          cacheVersion: WORKFORCE_REPORT_CACHE_VERSION,
        },
      });
    }

    let groups = await prismadb.workforceReportGroup.findMany({
      where: {
        departmentId: params.departmentId,
        ...(groupIds.length ? { id: { in: groupIds } } : {}),
      },
      include: {
        offices: {
          include: { office: { select: { id: true, name: true } } },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    const snapshots = (await loadLatestSnapshots(params.departmentId, cutoff)).filter((snapshot) =>
      populationMode === "active" ? snapshot.status === WORKFORCE_ACTIVE_STATUS : true
    );

    const columns = Array.from(new Set(snapshots.map((snapshot) => getDimensionValue(snapshot, dimension)))).sort((a, b) =>
      a.localeCompare(b)
    );

    const othersGroupId = groups.find((group) => group.name === WORKFORCE_OTHERS_INDICATOR)?.id;

    const groupRows = groups.map((group) => ({
      id: group.id,
      label: group.name,
      officeIds: new Set(group.offices.map((entry) => entry.officeId)),
      counts: Object.fromEntries(columns.map((column) => [column, 0])) as Record<string, number>,
      total: 0,
    }));

    const ungroupedRow = {
      id: "__UNGROUPED__",
      label: groups.length ? "Ungrouped" : "All Employees",
      officeIds: new Set<string>(),
      counts: Object.fromEntries(columns.map((column) => [column, 0])) as Record<string, number>,
      total: 0,
    };

    const rowsById = new Map(groupRows.map((row) => [row.id, row]));

    for (const snapshot of snapshots) {
      const column = getDimensionValue(snapshot, dimension);
      if (!columns.includes(column)) {
        columns.push(column);
      }

      const rowId =
        snapshot.indicatorId ??
        othersGroupId;
      const row = rowId ? rowsById.get(rowId) ?? ungroupedRow : ungroupedRow;
      row.counts[column] = (row.counts[column] ?? 0) + 1;
      row.total += 1;
    }

    const rows = [...groupRows, ungroupedRow]
      .filter((row) => row.total > 0)
      .map((row) => ({
        id: row.id,
        label: row.label,
        counts: Object.fromEntries(columns.map((column) => [column, row.counts[column] ?? 0])),
        total: row.total,
      }));

    const totals = Object.fromEntries(
      columns.map((column) => [column, rows.reduce((sum, row) => sum + (row.counts[column] ?? 0), 0)])
    );
    const grandTotal = rows.reduce((sum, row) => sum + row.total, 0);

    const responsePayload = {
      year,
      cutoff: cutoff.toISOString(),
      populationMode,
      dimension,
      columns,
      rows,
      totals,
      grandTotal,
      meta: {
        departmentId: params.departmentId,
        departmentName: access.department?.name,
        snapshotCount: snapshots.length,
        groupCount: groups.length,
        generatedAt: new Date().toISOString(),
        cacheStatus: "recomputed",
        cacheGeneratedAt: new Date().toISOString(),
        cacheVersion: WORKFORCE_REPORT_CACHE_VERSION,
      },
    };

    await upsertWorkforceReportCache(
      params.departmentId,
      year,
      populationMode,
      dimension,
      selectedGroupHash,
      groupIds,
      responsePayload
    );

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error("[WORKFORCE_HISTORY_REPORT_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
