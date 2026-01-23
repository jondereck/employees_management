import { prisma } from "@/lib/prisma";
import { streamReply } from "../utils";

export async function handleListOffices(context: any) {
  const offices = await prisma.offices.findMany({
    select: { name: true },
    orderBy: { name: "asc" },
  });

  if (!offices.length) {
    return streamReply(
      "No offices found.",
      context,
      null
    );
  }

  const list = offices
    .map((o, i) => `${i + 1}. ${o.name}`)
    .join("\n");

  return streamReply(
    `Here are the available offices:\n\n${list}\n\nYou can say for example:\n“how many male in HRMO”`,
    context,
    null
  );
}
