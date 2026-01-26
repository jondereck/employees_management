import { prisma } from "@/lib/prisma";
import { streamReply } from "../utils";

export async function handleListFromLastCount(context: any) {
  const last = context?.lastCountQuery;

  if (!last) {
    return streamReply(
      "I don’t have a previous count to list from.",
      context,
      null
    );
  }

  const employees = await prisma.employee.findMany({
    where: {
      isArchived: false,
      officeId: last.officeId,
      gender: last.gender,
      employeeTypeId: last.employeeTypeId,
    },
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
      position: true,
    },
  });

  if (employees.length === 0) {
    return streamReply(
      "No employees matched that query.",
      context,
      null
    );
  }

  const list = employees
    .map(
      (e) =>
        `• ${[e.firstName, e.middleName, e.lastName]
          .filter(Boolean)
          .join(" ")}`
    )
    .join("\n");

  return streamReply(
    `Here ${employees.length === 1 ? "is" : "are"} ${
      employees.length === 1 ? "the employee" : "the employees"
    }:\n\n${list}`,
    context,
    employees.length === 1 ? employees[0].id : null
  );
}
