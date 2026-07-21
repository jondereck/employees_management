export type AuthorizedPositionSummaryRow = {
  officeId: string;
  officeName: string;
  positionTitle: string;
  employeeTypeName: string;
  totalAuthorized: number;
  filled: number;
  vacant: number;
};

export function summarizeAuthorizedPositions(
  rows: readonly AuthorizedPositionSummaryRow[]
) {
  return rows.reduce(
    (totals, row) => ({
      totalAuthorized: totals.totalAuthorized + row.totalAuthorized,
      filled: totals.filled + row.filled,
      vacant: totals.vacant + row.vacant,
    }),
    { totalAuthorized: 0, filled: 0, vacant: 0 }
  );
}

export function aggregateAuthorizedPositionSummary({
  offices,
  positions,
  employees,
}: {
  offices: readonly { id: string; name: string }[];
  positions: readonly {
    id: string;
    officeId: string;
    title: string;
    employeeTypeName: string | null;
    isActive: boolean;
  }[];
  employees: readonly {
    plantillaPositionId: string | null;
    isArchived: boolean;
  }[];
}): AuthorizedPositionSummaryRow[] {
  const officeNameById = new Map(
    offices.map((office) => [office.id, office.name])
  );
  const occupiedPositionIds = new Set(
    employees
      .filter(
        (employee) => !employee.isArchived && employee.plantillaPositionId
      )
      .map((employee) => employee.plantillaPositionId as string)
  );
  const groups = new Map<string, AuthorizedPositionSummaryRow>();

  for (const position of positions) {
    if (!position.isActive) continue;

    const officeName =
      officeNameById.get(position.officeId)?.trim() || "Unknown Office";
    const positionTitle = position.title.trim() || "Untitled Position";
    const employeeTypeName =
      position.employeeTypeName?.trim() || "Unspecified";
    const key = [
      position.officeId,
      positionTitle.toLocaleLowerCase("en"),
      employeeTypeName.toLocaleLowerCase("en"),
    ].join("\u0000");
    const row = groups.get(key) ?? {
      officeId: position.officeId,
      officeName,
      positionTitle,
      employeeTypeName,
      totalAuthorized: 0,
      filled: 0,
      vacant: 0,
    };

    row.totalAuthorized += 1;
    if (occupiedPositionIds.has(position.id)) {
      row.filled += 1;
    } else {
      row.vacant += 1;
    }
    groups.set(key, row);
  }

  return [...groups.values()].sort(
    (left, right) =>
      left.officeName.localeCompare(right.officeName, "en", {
        sensitivity: "base",
      }) ||
      left.positionTitle.localeCompare(right.positionTitle, "en", {
        sensitivity: "base",
      }) ||
      left.employeeTypeName.localeCompare(right.employeeTypeName, "en", {
        sensitivity: "base",
      })
  );
}
