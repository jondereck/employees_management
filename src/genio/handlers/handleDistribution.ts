// src/genio/handlers/handleDistribution.ts
import { prisma } from "@/lib/prisma";

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
    resolveOfficeWithAliases (message, offices) ??
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

  const male = await prisma.employee.count({
    where: { ...where, gender: "Male" },
  });

  const female = await prisma.employee.count({
    where: { ...where, gender: "Female" },
  });

  return streamReply(
    `Gender distribution${
      office ? ` in ${office.name}` : ""
    }:\n\n**Male:** ${male}\n**Female:** ${female}`,
    context,
    null
  );
}
