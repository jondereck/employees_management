import { prisma } from "@/lib/prisma";
import { streamReply } from "../utils";

export async function handleList(context: any) {
  console.log("🔥 HANDLE LIST CALLED");

  if (!context?.lastQuery?.where) {
    return streamReply(
      "Please ask a count question first.",
      context,
      null
    );
  }

  const employees = await prisma.employee.findMany({
    where: context.lastQuery.where,
    orderBy: { lastName: "asc" },
    select: {
      firstName: true,
      lastName: true,
      employeeNo: true,
      id: true,
    },
  });

  if (!employees.length) {
    return streamReply(
      "I couldn’t find any employees.",
      context,
      null
    );
  }

  const names = employees.map((e, i) => {
    const first = e.firstName?.trim();
    const last = e.lastName?.trim();

    let displayName: string;

    if (first || last) {
      displayName = `${first ?? ""} ${last ?? ""}`.trim();
    } else if (e.employeeNo) {
      displayName = `Employee #${e.employeeNo}`;
    } else {
      displayName = "Unnamed employee";
    }

    return `${i + 1}. ${displayName}`;
  });

  return streamReply(
    `Here they are (**${employees.length} total**):\n\n${names.join("\n")}`,
    context,
    null
  );
}
