import { prisma } from "@/lib/prisma";
import { streamReply } from "../utils";

export async function handleWhoIs(
  message: string,
  context: any
) {
  const cleaned = message
    .toLowerCase()
    .replace(/^who is/i, "")
    .replace(/[^a-z\s]/g, "")
    .trim();

  if (!cleaned) {
    return streamReply(
      "Please tell me the employee’s name.",
      context,
      null
    );
  }

  // 🔹 Split full name into tokens
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

  // ❌ No match
  if (employees.length === 0) {
    return streamReply(
      `I couldn’t find an employee named **${cleaned}**.`,
      context,
      null
    );
  }

  // ⚠️ Multiple matches
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

  // ✅ Single match
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
