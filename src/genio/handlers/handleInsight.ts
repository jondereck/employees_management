// src/genio/handlers/handleInsight.ts
import { prisma } from "@/lib/prisma";
import { streamReply } from "../utils";
import { resolveOfficeWithAliases } from "../resolve-office";

export async function handleInsight(message: string, context: any) {
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

  /* ============================================================
     BASIC COUNTS
     ============================================================ */

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

  const totalEmployees = allCounts.reduce(
    (sum, o) => sum + o._count._all,
    0
  );

  const avg =
    allCounts.length > 0
      ? totalEmployees / allCounts.length
      : 0;

  /* ============================================================
     INSIGHT REASONS
     ============================================================ */

  const reasons: string[] = [];

  if (avg > 0) {
    if (officeCount < avg * 0.8) {
      reasons.push(
        `Staffing level is below the company average (${Math.round(avg)} employees)`
      );
    } else if (officeCount > avg * 1.2) {
      reasons.push(
        `Staffing level is above the company average (${Math.round(avg)} employees)`
      );
    } else {
      reasons.push(
        `Staffing level is close to the company average`
      );
    }
  }

  /* ============================================================
     HIRING TREND
     ============================================================ */

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
  } else {
    reasons.push(`${hiresThisYear} new hire(s) recorded this year`);
  }

  /* ============================================================
     WORKFORCE SHARE
     ============================================================ */

  if (totalEmployees > 0) {
    const share = ((officeCount / totalEmployees) * 100).toFixed(1);
    reasons.push(
      `Represents ${share}% of the total company workforce`
    );
  }

  /* ============================================================
     FINAL MESSAGE TONE
     ============================================================ */

  const headline =
    officeCount < avg * 0.8
      ? "appears understaffed"
      : officeCount > avg * 1.2
      ? "appears overstaffed"
      : "has balanced staffing";

  return streamReply(
    `📊 **Staffing insight for ${office.name}**\n\n${office.name} ${headline} based on current data:\n\n${reasons
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
