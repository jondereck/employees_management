// src/genio/handlers/handleWhoIs.ts
import { prisma } from "@/lib/prisma";
import { streamReply } from "../utils";


export async function handleWhoIs(
  message: string,
  context: any
) {
  const cleaned = message
    .toLowerCase()
    .replace("who is", "")
    .replace(/[^a-z\s]/gi, "")
    .trim();

  const parts = cleaned.split(/\s+/);
  if (parts.length < 2) {
    return streamReply(
      "Please provide the employee’s full name.",
      context,
      null
    );
  }

  const firstName = parts[0];
  const lastName = parts[parts.length - 1];

  const employees = await prisma.employee.findMany({
    where: {
      isArchived: false,
      firstName: { contains: firstName, mode: "insensitive" },
      lastName: { equals: lastName, mode: "insensitive" },
    },
    include: {
      offices: true,
      employeeType: true,
    },
  });

  if (employees.length === 0) {
    return streamReply(
      "I couldn’t find an employee with that name.",
      context,
      null
    );
  }

  if (employees.length > 1) {
    return streamReply(
      "I found multiple employees with that name. Please add more details.",
      context,
      null
    );
  }

  const emp = employees[0];

  const newContext = {
    ...context,
    focus: {
      type: "employee",
      id: emp.id,
      name: `${emp.firstName} ${emp.lastName}`,
    },
  };

  return streamReply(
    `${emp.firstName} ${emp.lastName} is a **${emp.position}** assigned to **${emp.offices.name}**.`,
    newContext,
    emp.id
  );
}
