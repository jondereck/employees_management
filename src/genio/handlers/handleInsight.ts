// src/genio/handlers/handleInsight.ts
import { prisma } from "@/lib/prisma";
import { streamReply } from "../utils";
import { resolveOfficeWithAliases } from "../resolve-office";


export async function handleInsight(
  message: string,
  context: any
) {
  const offices = await prisma.offices.findMany({
    select: { id: true, name: true },
  });

  const office =
    resolveOfficeWithAliases(message, offices) ??
    (context?.focus?.type === "office"
      ? offices.find((o) => o.id === context.focus.id)
      : null);

  if (!office) {
    return streamReply(
      "Please specify which office you want insights for.",
      context,
      null
    );
  }

  const officeCount = await prisma.employee.count({
    where: {
      isArchived: false,
      officeId: office.id,
    },
  });

  const allCounts = await prisma.employee.groupBy({
    by: ["officeId"],
    where: { isArchived: false },
    _count: { _all: true },
  });

  const avg =
    allCounts.reduce((s, o) => s + o._count._all, 0) /
    allCounts.length;

  const reasons: string[] = [];

  if (officeCount < avg * 0.8) {
    reasons.push(
      `Lower headcount compared to the company average (${Math.round(avg)} employees)`
    );
  }

  const startOfYear = new Date(new Date().getFullYear(), 0, 1);

  const hiresThisYear = await prisma.employee.count({
    where: {
      isArchived: false,
      officeId: office.id,
      dateHired: { gte: startOfYear },
    },
  });

  if (hiresThisYear === 0) {
    reasons.push("No new hires recorded this year");
  }

  if (reasons.length === 0) {
    reasons.push(
      "No significant staffing anomalies detected compared to other offices"
    );
  }

  return streamReply(
    `Here’s why **${office.name}** appears understaffed:\n\n${reasons
      .map((r) => `• ${r}`)
      .join("\n")}`,
    {
      ...context,
      focus: {
        type: "office",
        id: office.id,
        name: office.name,
      },
    },
    null
  );
}
