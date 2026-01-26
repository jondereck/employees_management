import { prisma } from "@/lib/prisma";
import { streamReply } from "../utils";
import { Gender } from "@prisma/client";
import { resolveOfficeWithAliases } from "../resolve-office";

export async function handleCompareOffices(
  message: string,
  context: any
) {
  const offices = await prisma.offices.findMany({
    select: { id: true, name: true },
  });

  // 🔑 Extract candidate office mentions from message
  const words = message.toLowerCase().split(/\s+/);

  const resolved: { id: string; name: string }[] = [];

  for (const word of words) {
    const office = resolveOfficeWithAliases(word, offices);
    if (
      office &&
      !resolved.find((o) => o.id === office.id)
    ) {
      resolved.push(office);
    }
  }

  if (resolved.length < 2) {
    return streamReply(
      "Please specify two offices to compare (e.g. “HR vs Marketing”).",
      context,
      null
    );
  }

  const [officeA, officeB] = resolved;

  async function getStats(officeId: string) {
    const [total, male, female] = await Promise.all([
      prisma.employee.count({
        where: { isArchived: false, officeId },
      }),
      prisma.employee.count({
        where: {
          isArchived: false,
          officeId,
          gender: Gender.Male,
        },
      }),
      prisma.employee.count({
        where: {
          isArchived: false,
          officeId,
          gender: Gender.Female,
        },
      }),
    ]);

    return { total, male, female };
  }

  const statsA = await getStats(officeA.id);
  const statsB = await getStats(officeB.id);

  const diff = statsA.total - statsB.total;
  const comparison =
    diff === 0
      ? "Both offices have the same number of employees."
      : diff > 0
      ? `${officeA.name} has ${diff} more employees than ${officeB.name}.`
      : `${officeB.name} has ${Math.abs(diff)} more employees than ${officeA.name}.`;

  return streamReply(
    `**${officeA.name} vs ${officeB.name}:**\n\n` +
      `• ${officeA.name}: ${statsA.total} employees (${statsA.female} female, ${statsA.male} male)\n` +
      `• ${officeB.name}: ${statsB.total} employees (${statsB.female} female, ${statsB.male} male)\n\n` +
      comparison,
    context,
    null,
    { canExport: true }
  );
}
