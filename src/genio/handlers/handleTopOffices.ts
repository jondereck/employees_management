import { prisma } from "@/lib/prisma";
import { streamReply } from "../utils";

export async function handleTopOffices(context: any) {
  const offices = await prisma.offices.findMany({
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          employee: {
            where: { isArchived: false },
          },
        },
      },
    },
  });

  const sorted = offices
    .map((o) => ({
      name: o.name,
      count: o._count.employee,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  if (sorted.length === 0) {
    return streamReply(
      "No office data available.",
      context,
      null
    );
  }

  const list = sorted
    .map((o, i) => `${i + 1}. **${o.name}** – ${o.count} employees`)
    .join("\n");

  return streamReply(
    `**Top 3 offices by size:**\n\n${list}`,
    context,
    null,
    { canExport: true }
  );
}
