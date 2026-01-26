import { prisma } from "@/lib/prisma";
import { Gender } from "@prisma/client";
import { streamReply } from "../utils";
import { GenioIntent } from "../type";
import { resolveOfficeWithAliases } from "../resolve-office";

export async function handleDistribution(
  intent: GenioIntent,
  context: any,
  message: string
) {
  const where: any = { isArchived: false };

  const offices = await prisma.offices.findMany({
    select: { id: true, name: true },
  });

  const office =
    resolveOfficeWithAliases(message, offices) ??
    (context?.focus?.type === "office"
      ? offices.find((o) => o.id === context.focus.id)
      : null);

  if (office) {
    where.officeId = office.id;

    context = {
      ...context,
      focus: {
        type: "office",
        id: office.id,
        name: office.name,
      },
    };
  }

  const [male, female] = await Promise.all([
    prisma.employee.count({
      where: { ...where, gender: Gender.Male },
    }),
    prisma.employee.count({
      where: { ...where, gender: Gender.Female },
    }),
  ]);

  const total = male + female;

  context = {
    ...context,
    lastDistributionQuery: {
      officeId: office?.id,
      officeName: office?.name,
    },
  };

  return streamReply(
    `Gender distribution${office ? ` in **${office.name}**` : ""}:\n\n` +
      `• **Male:** ${male}\n` +
      `• **Female:** ${female}\n` +
      `• **Total:** ${total}`,
    context,
    null
  );
}
