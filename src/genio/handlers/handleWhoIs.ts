import { prisma } from "@/lib/prisma";
import { streamReply } from "../utils";

export async function handleWhoIs(
  message: string,
  context: any
) {
  const cleaned = message
    .toLowerCase()
    .replace("who is", "")
    .replace(/[^a-z\s]/g, "")
    .trim();

  if (!cleaned) {
    return streamReply(
      "Please tell me the employee’s name.",
      context,
      null
    );
  }

  // 🔍 Search token (first name / last name / nickname)
  const search = cleaned;

  const employees = await prisma.employee.findMany({
    where: {
      isArchived: false,
      OR: [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { nickname: { contains: search, mode: "insensitive" } },
      ],
    },
    include: {
      offices: true,
      employeeType: true,
    },
  });

  // ❌ No match
  if (employees.length === 0) {
    return streamReply(
      "I couldn’t find an employee with that name.",
      context,
      null
    );
  }

  // ⚠️ Multiple matches → ask to clarify
  if (employees.length > 1) {
    const list = employees
      .slice(0, 5)
      .map(
        (e) =>
          `• ${e.firstName} ${e.lastName}${
            e.nickname ? ` (${e.nickname})` : ""
          }`
      )
      .join("\n");

    return streamReply(
      `I found multiple employees with that name. Who do you mean?\n\n${list}`,
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
    emp.id
  );
}
