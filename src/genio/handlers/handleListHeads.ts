import { prisma } from "@/lib/prisma";
import { streamReply } from "../utils";

export async function handleListHeads(context: any) {
  const heads = await prisma.employee.findMany({
    where: {
      isHead: true,
      isArchived: false,
    },
    include: {
      offices: true,
    },
    orderBy: {
      offices: { name: "asc" },
    },
  });

  if (heads.length === 0) {
    return streamReply(
      "No office heads are currently assigned.",
      context,
      null
    );
  }

  const list = heads
    .map(
      (e) =>
        `• **${e.offices.name}** — ${e.firstName} ${e.lastName}`
    )
    .join("\n");

  return streamReply(
    `Here are the current office heads:\n\n${list}`,
    context,
    null
  );
}
  