const SUPERVISORY_GRADE_CUTOFF = 10;

export const PIVOT_FIELDS = [
  "office",
  "employeeType",
  "eligibility",
  "supervisory",
  "gender",
] as const;

export type PivotField = (typeof PIVOT_FIELDS)[number];

const SUPERVISORY_LABELS: Record<string, string> = {
  supervisory: `Supervisory (SG ${SUPERVISORY_GRADE_CUTOFF}+)`,
  nonSupervisory: "Non-Supervisory (SG 1–9)",
  unspecified: "No Salary Grade",
};
const SUPERVISORY_ORDER = ["supervisory", "nonSupervisory", "unspecified"];

const GENDER_LABELS: Record<string, string> = { male: "Male", female: "Female" };
const GENDER_ORDER = ["male", "female"];

export type PivotTag = { key: string; name: string };

export type PivotEmployeeInput = {
  id: string;
  gender: string | null;
  salaryGrade: number | null;
  officeId: string | null;
  officeName: string | null;
  employeeTypeId: string | null;
  employeeTypeName: string | null;
  eligibilityId: string | null;
  eligibilityName: string | null;
};

export type PivotRow = PivotTag & {
  groupKey?: string;
  groupLabel?: string;
  leafKey?: string;
  leafLabel?: string;
};

export type PivotResult = {
  rowFields: PivotField[];
  colField: PivotField;
  rows: PivotRow[];
  cols: PivotTag[];
  matrix: number[][];
  rowTotals: number[];
  colTotals: number[];
  grandTotal: number;
};

type TaggedEmployee = Record<PivotField, PivotTag>;

const isPivotField = (value: unknown): value is PivotField =>
  typeof value === "string" && (PIVOT_FIELDS as readonly string[]).includes(value);

export function resolvePivotAxes(body: {
  rowFields?: unknown;
  rowField?: unknown;
  colField?: unknown;
}): { rowFields: PivotField[]; colField: PivotField } | { error: string } {
  let rowFields: PivotField[] | null = null;

  if (Array.isArray(body.rowFields)) {
    if (body.rowFields.length < 1 || body.rowFields.length > 2) {
      return { error: "rowFields must contain 1 or 2 fields" };
    }
    const resolved: PivotField[] = [];
    for (const entry of body.rowFields) {
      if (!isPivotField(entry)) {
        return { error: "rowFields contains an invalid field" };
      }
      if (resolved.includes(entry)) {
        return { error: "rowFields must be distinct" };
      }
      resolved.push(entry);
    }
    rowFields = resolved;
  } else if (isPivotField(body.rowField)) {
    rowFields = [body.rowField];
  } else if (body.rowFields != null || body.rowField != null) {
    return { error: "Invalid rowFields" };
  } else {
    rowFields = ["supervisory"];
  }

  const colField = isPivotField(body.colField) ? body.colField : null;
  if (!colField) {
    return { error: "colField is required and must be a valid pivot field" };
  }
  if (rowFields.includes(colField)) {
    return { error: "colField must not appear in rowFields" };
  }

  return { rowFields, colField };
}

function orderTags(field: PivotField, present: Map<string, string>): PivotTag[] {
  if (field === "supervisory") {
    return SUPERVISORY_ORDER.filter((key) => present.has(key)).map((key) => ({
      key,
      name: present.get(key)!,
    }));
  }
  if (field === "gender") {
    return GENDER_ORDER.filter((key) => present.has(key)).map((key) => ({
      key,
      name: present.get(key)!,
    }));
  }
  return Array.from(present.entries())
    .map(([key, name]) => ({ key, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function tagEmployee(employee: PivotEmployeeInput): TaggedEmployee {
  const grade = employee.salaryGrade;
  const supervisoryKey =
    grade == null || grade <= 0
      ? "unspecified"
      : grade >= SUPERVISORY_GRADE_CUTOFF
        ? "supervisory"
        : "nonSupervisory";
  const genderKey = employee.gender === "Female" ? "female" : "male";

  return {
    office: {
      key: employee.officeId?.trim() || "unassigned",
      name: employee.officeName?.trim() || "Unassigned",
    },
    employeeType: {
      key: employee.employeeTypeId?.trim() || "unassigned",
      name: employee.employeeTypeName?.trim() || "Unassigned",
    },
    eligibility: {
      key: employee.eligibilityId?.trim() || "unassigned",
      name: employee.eligibilityName?.trim() || "Unspecified",
    },
    supervisory: { key: supervisoryKey, name: SUPERVISORY_LABELS[supervisoryKey] },
    gender: { key: genderKey, name: GENDER_LABELS[genderKey] },
  };
}

export function buildWorkforcePivot(args: {
  employees: PivotEmployeeInput[];
  rowFields: PivotField[];
  colField: PivotField;
}): PivotResult {
  const { employees, rowFields, colField } = args;
  const nested = rowFields.length === 2;
  const primaryField = rowFields[0];
  const secondaryField = nested ? rowFields[1] : null;

  const tagged = employees.map(tagEmployee);

  const rowNames = new Map<string, string>();
  const colNames = new Map<string, string>();
  const cellCounts = new Map<string, number>();
  const nestedMeta = new Map<
    string,
    { groupKey: string; groupLabel: string; leafKey: string; leafLabel: string }
  >();

  for (const employee of tagged) {
    const col = employee[colField];
    colNames.set(col.key, col.name);

    let rowKey: string;
    let rowName: string;

    if (nested && secondaryField) {
      const group = employee[primaryField];
      const leaf = employee[secondaryField];
      rowKey = `${group.key}::${leaf.key}`;
      rowName = leaf.name;
      rowNames.set(rowKey, rowName);
      nestedMeta.set(rowKey, {
        groupKey: group.key,
        groupLabel: group.name,
        leafKey: leaf.key,
        leafLabel: leaf.name,
      });
    } else {
      const row = employee[primaryField];
      rowKey = row.key;
      rowName = row.name;
      rowNames.set(rowKey, rowName);
    }

    const cellKey = `${rowKey}::${col.key}`;
    cellCounts.set(cellKey, (cellCounts.get(cellKey) ?? 0) + 1);
  }

  let rows: PivotRow[];

  if (nested && secondaryField) {
    const groupPresent = new Map<string, string>();
    const leavesByGroup = new Map<string, Map<string, string>>();

    for (const meta of nestedMeta.values()) {
      groupPresent.set(meta.groupKey, meta.groupLabel);
      if (!leavesByGroup.has(meta.groupKey)) {
        leavesByGroup.set(meta.groupKey, new Map());
      }
      leavesByGroup.get(meta.groupKey)!.set(meta.leafKey, meta.leafLabel);
    }

    const orderedGroups = orderTags(primaryField, groupPresent);
    rows = [];
    for (const group of orderedGroups) {
      const leafPresent = leavesByGroup.get(group.key) ?? new Map();
      const orderedLeaves = orderTags(secondaryField, leafPresent);
      for (const leaf of orderedLeaves) {
        const key = `${group.key}::${leaf.key}`;
        rows.push({
          key,
          name: leaf.name,
          groupKey: group.key,
          groupLabel: group.name,
          leafKey: leaf.key,
          leafLabel: leaf.name,
        });
      }
    }
  } else {
    rows = orderTags(primaryField, rowNames).map((tag) => ({ ...tag }));
  }

  const cols = orderTags(colField, colNames);
  const matrix = rows.map((row) => cols.map((col) => cellCounts.get(`${row.key}::${col.key}`) ?? 0));
  const rowTotals = matrix.map((row) => row.reduce((sum, value) => sum + value, 0));
  const colTotals = cols.map((_, colIndex) => matrix.reduce((sum, row) => sum + row[colIndex], 0));
  const grandTotal = rowTotals.reduce((sum, value) => sum + value, 0);

  return {
    rowFields,
    colField,
    rows,
    cols,
    matrix,
    rowTotals,
    colTotals,
    grandTotal,
  };
}
