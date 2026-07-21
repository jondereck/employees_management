const DEFAULT_TIME_ZONE = "Asia/Manila";
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

export type DashboardMovementInput = {
  id: string;
  employeeId: string;
  name: string;
  office: string | null;
  position: string | null;
  occurredAt: Date | string;
  details?: string | null;
  deletedAt?: Date | string | null;
};

export type DashboardMovementRow = {
  id: string;
  employeeId: string;
  name: string;
  office: string;
  position: string;
  dateLabel: string;
  details?: string;
  href: string;
};

export type DashboardMovementCategory = {
  count: number;
  employees: DashboardMovementRow[];
};

export type DashboardEmployeeMovementsSummary = {
  total: number;
  monthLabel: string;
  hired: DashboardMovementCategory;
  promoted: DashboardMovementCategory;
  separated: DashboardMovementCategory;
};

const parseDate = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const getManilaYearMonth = (value: Date, timeZone = DEFAULT_TIME_ZONE) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
  }).formatToParts(value);

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);

  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;

  return { year, month };
};

export function getManilaMonthUtcRange(now = new Date()) {
  const parts = getManilaYearMonth(now);
  const year = parts?.year ?? now.getUTCFullYear();
  const month = parts?.month ?? now.getUTCMonth() + 1;

  const start = new Date(Date.UTC(year, month - 1, 1) - MANILA_OFFSET_MS);
  const end = new Date(Date.UTC(year, month, 1) - MANILA_OFFSET_MS);

  const monthLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: DEFAULT_TIME_ZONE,
    month: "long",
    year: "numeric",
  }).format(now);

  return { start, end, monthLabel };
}

const parseMovementDetails = (details?: string | null): string | undefined => {
  if (!details?.trim()) return undefined;

  try {
    const parsed: unknown = JSON.parse(details);

    if (typeof parsed === "string") {
      return parsed.trim() || undefined;
    }

    if (typeof parsed !== "object" || parsed === null) {
      return undefined;
    }

    const detailObject = parsed as {
      description?: unknown;
      title?: unknown;
    };

    if (
      typeof detailObject.description === "string" &&
      detailObject.description.trim().length > 0
    ) {
      return detailObject.description.trim();
    }

    if (
      typeof detailObject.title === "string" &&
      detailObject.title.trim().length > 0
    ) {
      return detailObject.title.trim();
    }

    return undefined;
  } catch {
    return details.trim();
  }
};

const isInRange = (date: Date, start: Date, end: Date) =>
  date.getTime() >= start.getTime() && date.getTime() < end.getTime();

const isDeleted = (deletedAt?: Date | string | null) => {
  if (deletedAt == null) return false;
  const date = parseDate(deletedAt);
  return date != null;
};

const buildCategory = (
  rows: DashboardMovementInput[],
  range: { start: Date; end: Date },
  departmentId: string,
  includeDetails: boolean,
): DashboardMovementCategory => {
  const employees = rows
    .filter((row) => {
      if (isDeleted(row.deletedAt)) return false;

      const occurredAt = parseDate(row.occurredAt);
      if (!occurredAt) return false;

      return isInRange(occurredAt, range.start, range.end);
    })
    .sort((a, b) => {
      const aDate = parseDate(a.occurredAt)!;
      const bDate = parseDate(b.occurredAt)!;
      const timeDiff = bDate.getTime() - aDate.getTime();
      if (timeDiff !== 0) return timeDiff;
      return a.name.localeCompare(b.name);
    })
    .map((row) => {
      const occurredAt = parseDate(row.occurredAt)!;
      const office = row.office?.trim() || "Unassigned Office";
      const position = row.position?.trim() || "Position not specified";
      const details = includeDetails ? parseMovementDetails(row.details) : undefined;

      return {
        id: row.id,
        employeeId: row.employeeId,
        name: row.name,
        office,
        position,
        dateLabel: new Intl.DateTimeFormat("en-PH", {
          timeZone: DEFAULT_TIME_ZONE,
          month: "short",
          day: "numeric",
          year: "numeric",
        }).format(occurredAt),
        ...(details ? { details } : {}),
        href: `/${departmentId}/employees/${row.employeeId}`,
      };
    });

  return {
    count: employees.length,
    employees,
  };
};

export function buildDashboardEmployeeMovementsSummary(
  input: {
    hired: DashboardMovementInput[];
    promoted: DashboardMovementInput[];
    separated: DashboardMovementInput[];
  },
  departmentId: string,
  now = new Date(),
): DashboardEmployeeMovementsSummary {
  const range = getManilaMonthUtcRange(now);

  const hired = buildCategory(input.hired, range, departmentId, false);
  const promoted = buildCategory(input.promoted, range, departmentId, true);
  const separated = buildCategory(input.separated, range, departmentId, true);

  return {
    total: hired.count + promoted.count + separated.count,
    monthLabel: range.monthLabel,
    hired,
    promoted,
    separated,
  };
}
