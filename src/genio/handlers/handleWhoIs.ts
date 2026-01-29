import { prisma } from "@/lib/prisma";
import { streamReply } from "../utils";
import { GenioIntent } from "../intent-schema";

export async function handleWhoIs(
  message: string,
  context: any,
  intent?: GenioIntent
) {
  const raw =
    intent?.filters?.name ??
    message
      .toLowerCase()
      .replace(
        /who is|who are|tell me about|sino si|impormasyon ni|who's|whos/gi,
        ""
      )
      .trim();

  if (!raw) {
    return streamReply(
      "Please provide an employee name or employee number.",
      context,
      null
    );
  }

  /* ===============================
     EMPLOYEE NUMBER LOOKUP (FIRST)
     =============================== */

  const employeeNumbers = raw.match(/\b\d{6,10}\b/g);

  if (employeeNumbers && employeeNumbers.length > 0) {
    const employees = await prisma.employee.findMany({
      where: {
        isArchived: false,
        OR: employeeNumbers.map((num) => ({
          employeeNo: {
            contains: num,
            mode: "insensitive",
          },
        })),
      },
      include: {
        offices: true,
        employeeType: true,
      },
    });


    if (employees.length === 0) {
      return streamReply(
        "I couldn’t find any employees with the provided employee number(s).",
        context,
        null
      );
    }

    if (employees.length > 1) {
      const list = employees
        .map(
          (e, i) =>
            `${i + 1}. ${e.employeeNo} – ${e.firstName} ${e.lastName} (${e.offices?.name})`
        )
        .join("\n");

      context = {
        ...context,
        lastListQuery: {
          type: "employee_lookup",
          where: {
            id: {
              in: employees.map((e) => e.id),
            },
          },
        },
      };


      return streamReply(
        `Here are the employees you asked for:\n\n${list}`,
        context,
        null,
        { canExport: true }
      );
    }

    const emp = employees[0];

    context = {
      ...context,
      lastEmployeeId: emp.id,
      lastOfficeId: emp.officeId,
      lastOfficeName: emp.offices?.name,
    };

    return streamReply(
      `${emp.firstName} ${emp.lastName} is a **${emp.position}** in **${emp.offices?.name}**.`,
      context,
      emp.id,
      { canExport: true }
    );
  }

  /* ===============================
     NAME-BASED LOOKUP (SECOND)
     =============================== */

  const cleaned = raw.replace(/[^a-z\s]/g, "").trim();

  const tokens = cleaned.split(/\s+/).filter(Boolean);

  const employees = await prisma.employee.findMany({
    where: {
      isArchived: false,
      AND: tokens.map((token) => ({
        OR: [
          { firstName: { contains: token, mode: "insensitive" } },
          { middleName: { contains: token, mode: "insensitive" } },
          { lastName: { contains: token, mode: "insensitive" } },
          { nickname: { contains: token, mode: "insensitive" } },
        ],
      })),
    },
    include: {
      offices: true,
      employeeType: true,
    },
  });

  if (employees.length === 0) {
    return streamReply(
      `I couldn’t find an employee named **${cleaned}**.`,
      context,
      null
    );
  }

  if (employees.length > 1) {
    const list = employees
      .slice(0, 5)
      .map(
        (e) =>
          `• ${e.firstName} ${e.middleName} ${e.lastName}`.replace(
            /\s+/g,
            " "
          )
      )
      .join("\n");

    return streamReply(
      `I found multiple employees matching **${cleaned}**. Who do you mean?\n\n${list}`,
      context,
      null
    );
  }

  const emp = employees[0];

  context = {
    ...context,
    lastEmployeeId: emp.id,
    lastOfficeId: emp.officeId,
    lastOfficeName: emp.offices?.name,
  };

  return streamReply(
    `${emp.firstName} ${emp.lastName} is a **${emp.position}** in **${emp.offices?.name}**.`,
    context,
    emp.id,
  );
}