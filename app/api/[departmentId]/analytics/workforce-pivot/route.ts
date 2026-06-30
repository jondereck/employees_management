import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";

const SUPERVISORY_GRADE_CUTOFF = 10;

const PIVOT_FIELDS = ["employeeType", "eligibility", "supervisory", "gender"] as const;
type PivotField = (typeof PIVOT_FIELDS)[number];

const SUPERVISORY_LABELS: Record<string, string> = {
  supervisory: `Supervisory (SG ${SUPERVISORY_GRADE_CUTOFF}+)`,
  nonSupervisory: "Non-Supervisory (SG 1–9)",
  unspecified: "No Salary Grade",
};
const SUPERVISORY_ORDER = ["supervisory", "nonSupervisory", "unspecified"];

const GENDER_LABELS: Record<string, string> = { male: "Male", female: "Female" };
const GENDER_ORDER = ["male", "female"];

type Tag = { key: string; name: string };

type TaggedEmployee = {
  employeeType: Tag;
  eligibility: Tag;
  supervisory: Tag;
  gender: Tag;
};

const isPivotField = (value: unknown): value is PivotField =>
  typeof value === "string" && (PIVOT_FIELDS as readonly string[]).includes(value);

const resolveField = (value: unknown, fallback: PivotField): PivotField =>
  isPivotField(value) ? value : fallback;

const normalizeIdArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry === "string" && entry.trim()) seen.add(entry.trim());
  }
  return Array.from(seen);
};

const orderTags = (field: PivotField, present: Map<string, string>): Tag[] => {
  if (field === "supervisory") {
    return SUPERVISORY_ORDER.filter((key) => present.has(key)).map((key) => ({ key, name: present.get(key)! }));
  }
  if (field === "gender") {
    return GENDER_ORDER.filter((key) => present.has(key)).map((key) => ({ key, name: present.get(key)! }));
  }
  return Array.from(present.entries())
    .map(([key, name]) => ({ key, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

export async function POST(req: Request, { params }: { params: { departmentId: string } }) {
  try {
    const { departmentId } = params;
    const { userId } = auth();

    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 401 });
    }
    if (!departmentId) {
      return new NextResponse("Department Id is required", { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new NextResponse("Invalid payload", { status: 400 });
    }

    const rowField = resolveField(body.rowField, "supervisory");
    const colField = resolveField(body.colField, "gender");
    if (rowField === colField) {
      return new NextResponse("rowField and colField must differ", { status: 400 });
    }

    const employeeTypeIds = normalizeIdArray(body.employeeTypeIds);
    const eligibilityIds = normalizeIdArray(body.eligibilityIds);

    const employees = await prismadb.employee.findMany({
      where: {
        departmentId,
        isArchived: false,
        ...(employeeTypeIds.length ? { employeeTypeId: { in: employeeTypeIds } } : {}),
        ...(eligibilityIds.length ? { eligibilityId: { in: eligibilityIds } } : {}),
      },
      select: {
        gender: true,
        salaryGrade: true,
        employeeTypeId: true,
        eligibilityId: true,
        employeeType: { select: { name: true } },
        eligibility: { select: { name: true } },
      },
    });

    const tagged: TaggedEmployee[] = employees.map((employee) => {
      const grade = employee.salaryGrade;
      const supervisoryKey =
        grade == null || grade <= 0
          ? "unspecified"
          : grade >= SUPERVISORY_GRADE_CUTOFF
            ? "supervisory"
            : "nonSupervisory";
      const genderKey = employee.gender === "Female" ? "female" : "male";

      return {
        employeeType: {
          key: employee.employeeTypeId ?? "unassigned",
          name: employee.employeeType?.name?.trim() || "Unassigned",
        },
        eligibility: {
          key: employee.eligibilityId ?? "unassigned",
          name: employee.eligibility?.name?.trim() || "Unspecified",
        },
        supervisory: { key: supervisoryKey, name: SUPERVISORY_LABELS[supervisoryKey] },
        gender: { key: genderKey, name: GENDER_LABELS[genderKey] },
      };
    });

    const rowNames = new Map<string, string>();
    const colNames = new Map<string, string>();
    const cellCounts = new Map<string, number>();

    for (const employee of tagged) {
      const r = employee[rowField];
      const c = employee[colField];
      rowNames.set(r.key, r.name);
      colNames.set(c.key, c.name);
      const cellKey = `${r.key}::${c.key}`;
      cellCounts.set(cellKey, (cellCounts.get(cellKey) ?? 0) + 1);
    }

    const rows = orderTags(rowField, rowNames);
    const cols = orderTags(colField, colNames);

    const matrix = rows.map((row) => cols.map((col) => cellCounts.get(`${row.key}::${col.key}`) ?? 0));
    const rowTotals = matrix.map((row) => row.reduce((sum, value) => sum + value, 0));
    const colTotals = cols.map((_, colIndex) => matrix.reduce((sum, row) => sum + row[colIndex], 0));
    const grandTotal = rowTotals.reduce((sum, value) => sum + value, 0);

    return NextResponse.json({
      rowField,
      colField,
      rows,
      cols,
      matrix,
      rowTotals,
      colTotals,
      grandTotal,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[WORKFORCE_PIVOT_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
