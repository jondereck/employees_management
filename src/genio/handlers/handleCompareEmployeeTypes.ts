import { prisma } from "@/lib/prisma";
import { streamReply } from "../utils";
import { resolveOfficeWithAliases } from "../resolve-office";

export async function handleCompareEmployeeTypes(
  message: string,
  context: any
) {
  const offices = await prisma.offices.findMany({
    select: { id: true, name: true },
  });

  const words = message.toLowerCase().split(/\s+/);
  const resolved: { id: string; name: string }[] = [];

  for (const word of words) {
    const office = resolveOfficeWithAliases(word, offices);
    if (office && !resolved.find((o) => o.id === office.id)) {
      resolved.push(office);
    }
  }

  if (resolved.length < 2) {
    return streamReply(
      "Please specify two offices to compare.",
      context,
      null
    );
  }

  const [officeA, officeB] = resolved;

  async function getTypes(officeId: string) {
    const rows = await prisma.employee.groupBy({
      by: ["employeeTypeId"],
      where: {
        isArchived: false,
        officeId,
      },
      _count: true,
    });

    const types = await prisma.employeeType.findMany({
      where: {
        id: { in: rows.map((r) => r.employeeTypeId) },
      },
    });

    return rows.map((r) => ({
      name:
        types.find((t) => t.id === r.employeeTypeId)?.name ??
        "Unknown",
      count: r._count,
    }));
  }

  const [typesA, typesB] = await Promise.all([
    getTypes(officeA.id),
    getTypes(officeB.id),
  ]);

  const allTypes = Array.from(
    new Set([
      ...typesA.map((t) => t.name),
      ...typesB.map((t) => t.name),
    ])
  );

  const lines = allTypes.map((type) => {
    const a = typesA.find((t) => t.name === type)?.count ?? 0;
    const b = typesB.find((t) => t.name === type)?.count ?? 0;
    return `• **${type}** — ${officeA.name}: ${a}, ${officeB.name}: ${b}`;
  });

  return streamReply(
    `**Employee type comparison:**\n\n${lines.join("\n")}`,
    context,
    null,
    { canExport: true }
  );
}
