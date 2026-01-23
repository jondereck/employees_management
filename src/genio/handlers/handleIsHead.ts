import { prisma } from "@/lib/prisma";
import { streamReply } from "../utils";
import { resolveOfficeWithAliases } from "../resolve-office";

export async function handleIsHead(
  message: string,
  context: any
) {
  const lower = message.toLowerCase().replace("?", "").trim();

  // 🧠 split safely
  const parts = lower.split(" the head of ");

  if (parts.length < 2) {
    return streamReply(
      "Please ask in the format: Is [name] the head of [office]?",
      context,
      null
    );
  }

  const nameQuery = parts[0]
    .replace(/^is\s+/i, "")
    .trim();

  const officePart = parts[1]?.trim();

  if (!nameQuery || !officePart) {
    return streamReply(
      "Please ask in the format: Is [name] the head of [office]?",
      context,
      null
    );
  }

  // 🏢 resolve office
  const offices = await prisma.offices.findMany({
    select: { id: true, name: true },
  });

  const office = resolveOfficeWithAliases(officePart, offices);

  if (!office) {
    return streamReply(
      "I couldn’t identify which office you meant.",
      context,
      null
    );
  }

const nameTokens = nameQuery.split(" ").filter(Boolean);

const employees = await prisma.employee.findMany({
  where: {
    officeId: office.id,
    isArchived: false,
    OR: nameTokens.flatMap(token => [
      { firstName: { contains: token, mode: "insensitive" } },
      { lastName: { contains: token, mode: "insensitive" } },
      { nickname: { contains: token, mode: "insensitive" } },
    ]),
  },
});


  if (employees.length === 0) {
    return streamReply(
      `I couldn’t find "${nameQuery}" in **${office.name}**.`,
      context,
      null
    );
  }

  if (employees.length > 1) {
    const list = employees
      .map(e => `• ${e.firstName} ${e.lastName}`)
      .join("\n");

    return streamReply(
      `I found multiple matches. Who do you mean?\n\n${list}`,
      context,
      null
    );
  }

  const emp = employees[0];

  // ✅ answer
  if (!emp.isHead) {
    return streamReply(
      `No. **${emp.firstName} ${emp.lastName}** is not the head of **${office.name}**.`,
      {
        ...context,
        lastEmployeeId: emp.id,
        lastOfficeId: office.id,
      },
      emp.id
    );
  }

  return streamReply(
    `Yes. **${emp.firstName} ${emp.lastName}** is the head of **${office.name}**.`,
    {
      ...context,
      lastEmployeeId: emp.id,
      lastOfficeId: office.id,
    },
    emp.id
  );
}
