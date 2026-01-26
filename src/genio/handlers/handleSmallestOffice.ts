import { prisma } from "@/lib/prisma";
import { streamReply } from "../utils";

export async function handleSmallestOffice(context: any) {
  const offices = await prisma.offices.findMany({
    select: {
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

  const smallest = offices
    .map((o) => ({
      name: o.name,
      count: o._count.employee,
    }))
    .sort((a, b) => a.count - b.count)[0];

  if (!smallest) {
    return streamReply(
      "No office data available.",
      context,
      null
    );
  }

  return streamReply(
    `The smallest office is **${smallest.name}** with **${smallest.count} employees**.`,
    context,
    null,
    { canExport: true }
  );
}
