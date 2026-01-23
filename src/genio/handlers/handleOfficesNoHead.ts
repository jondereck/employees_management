import { prisma } from "@/lib/prisma";
import { streamReply } from "../utils";

export async function handleOfficesNoHead(context: any) {
  const offices = await prisma.offices.findMany({
    include: {
      employee: {
        where: {
          isHead: true,
          isArchived: false,
        },
      },
    },
  });

  const noHead = offices.filter(o => o.employee.length === 0);

  if (noHead.length === 0) {
    return streamReply(
      "All offices currently have a designated head.",
      context,
      null
    );
  }

  const list = noHead
    .map((o, i) => `${i + 1}. ${o.name}`)
    .join("\n");

  return streamReply(
    `These offices do not have a head assigned:\n\n${list}`,
    context,
    null
  );
}
