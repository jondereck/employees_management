import { prisma } from "@/lib/prisma";
import { streamReply } from "../utils";

function startOfYear(year: number) {
  return new Date(year, 0, 1);
}

function endOfYear(year: number) {
  return new Date(year, 11, 31, 23, 59, 59, 999);
}

function parseUSDate(value?: string | null): Date | null {
  if (!value) return null;

  const [month, day, year] = value.split("/").map(Number);
  if (!month || !day || !year) return null;

  return new Date(year, month - 1, day);
}

export async function handleCurrentEmployeesByYear(
  year: number | undefined,
  context: any
) {
  const targetYear = year ?? new Date().getFullYear();
  const yearEnd = endOfYear(targetYear);

  /* ===============================
     FETCH EMPLOYEES
     =============================== */
  const employees = await prisma.employee.findMany({
    where: {
      dateHired: { lte: yearEnd },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dateHired: true,
      terminateDate: true,
      employeeTypeId: true,
      employeeType: {
        select: { id: true, name: true },
      },
    },
    orderBy: { lastName: "asc" },
  });

  /* ===============================
     FILTER CURRENT
     =============================== */
  const currentEmployees = employees.filter((e) => {
    const termination = parseUSDate(e.terminateDate);

    if (!termination) return true;
    return termination > yearEnd;
  });

  if (currentEmployees.length === 0) {
    return streamReply(
      `No current employees as of **${targetYear}**.`,
      context,
      null
    );
  }

  /* ===============================
     BREAKDOWN BY EMPLOYEE TYPE
     =============================== */
  const breakdownMap: Record<string, number> = {};

  currentEmployees.forEach((e) => {
    const typeName = e.employeeType?.name ?? "Unknown";
    breakdownMap[typeName] = (breakdownMap[typeName] || 0) + 1;
  });

  const breakdownList = Object.entries(breakdownMap)
    .sort((a, b) => b[1] - a[1]) // highest first
    .map(([name, count]) => `• **${name}** — ${count}`)
    .join("\n");

  /* ===============================
     OPTIONAL: PREVIEW LIST
     =============================== */
  const list = currentEmployees
    .slice(0, 20)
    .map(
      (e, i) => `${i + 1}. ${e.lastName}, ${e.firstName}`
    )
    .join("\n");

  const more =
    currentEmployees.length > 20
      ? `\n\n…and ${currentEmployees.length - 20} more.`
      : "";

  /* ===============================
     SAVE CONTEXT
     =============================== */
  context = {
    ...context,
    lastCountQuery: {
      type: "currentEmployeesByYear",
      year: targetYear,
      where: {
        dateHired: { lte: yearEnd },
      },
      postFilter: {
        excludeTerminatedOnOrBefore: targetYear,
      },
    },
  };

  /* ===============================
     FINAL RESPONSE
     =============================== */
  return streamReply(
    `There are **${currentEmployees.length} current employees** as of **${targetYear}**.\n\n` +
      `### Breakdown by Employee Type\n` +
      `${breakdownList}\n\n` +
      `### Sample List\n${list}${more}`,
    context,
    null,
    { canExport: true }
  );
}