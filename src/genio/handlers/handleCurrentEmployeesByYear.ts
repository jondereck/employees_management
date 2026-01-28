import { prisma } from "@/lib/prisma";
import { streamReply } from "../utils";

function startOfYear(year: number) {
  return new Date(year, 0, 1); // Jan 1
}

function endOfYear(year: number) {
  return new Date(year, 11, 31, 23, 59, 59, 999); // Dec 31
}

// MM/DD/YYYY → Date
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
     FETCH EMPLOYEES (NO isArchived)
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
      terminateDate: true, // MM/DD/YYYY
      officeId: true,
      employeeTypeId: true,
    },
    orderBy: { lastName: "asc" },
  });

  /* ===============================
     APPLY "CURRENT BY END OF YEAR"
     =============================== */
  const currentEmployees = employees.filter((e) => {
    const termination = parseUSDate(e.terminateDate);

    // still employed
    if (!termination) return true;

    // terminated AFTER the year
    return termination > yearEnd;
  });

  /* ===============================
     RESPONSE
     =============================== */
  if (currentEmployees.length === 0) {
    return streamReply(
      `No current employees as of **${targetYear}**.`,
      context,
      null
    );
  }

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

context = {
  ...context,
  lastCountQuery: {
    type: "currentEmployeesByYear",
    year: targetYear,

    // Base Prisma filter (safe)
    where: {
      dateHired: { lte: yearEnd },
    },

    // 🔑 tell export this is special
    postFilter: {
      excludeTerminatedOnOrBefore: targetYear,
    },
  },
};


  return streamReply(
    `There are **${currentEmployees.length} current employees** as of **${targetYear}**.\n\n${list}${more}`,
    context,
    null,
    { canExport: true }
  );
}
