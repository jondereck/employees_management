import { prisma } from "@/lib/prisma";
import { streamReply } from "../utils";
import { resolveOfficeWithAliases } from "../resolve-office";

export async function handleWhoIsHead(
  message: string,
  context: any
) {
  // 1️⃣ Resolve office
  const offices = await prisma.offices.findMany({
    select: { id: true, name: true },
  });

  const office = resolveOfficeWithAliases(message, offices);

  if (!office) {
    return streamReply(
      "I couldn’t identify which office you mean. Please specify the office name.",
      context,
      null
    );
  }

  // 2️⃣ Find head of office
  const heads = await prisma.employee.findMany({
    where: {
      officeId: office.id,
      isHead: true,
      isArchived: false,
    },
    include: {
      offices: true,
    },
  });

  // ❌ No head assigned
  if (heads.length === 0) {
    return streamReply(
      `There is currently no head assigned for **${office.name}**.`,
      context,
      null
    );
  }

  // ⚠️ Multiple heads (data issue)
  if (heads.length > 1) {
    const names = heads
      .map((e) => `• ${e.firstName} ${e.lastName}`)
      .join("\n");

    return streamReply(
      `I found multiple heads for **${office.name}** (please check the data):\n\n${names}`,
      context,
      null
    );
  }

  // ✅ Single head
  const head = heads[0];

  context = {
    ...context,
    lastEmployeeId: head.id,
    lastOfficeId: office.id,
    lastOfficeName: office.name,
  };

  return streamReply(
    `The head of **${office.name}** is **${head.firstName} ${head.lastName}**.`,
    context,
    head.id
  );
}
