import { prisma } from "@/lib/prisma";
import { streamReply } from "../utils";
import { computeTenure } from "@/utils/tenure";

export async function handleTenureAnalysis(
  intent: any,
  context: any
) {
  const where: any = { isArchived: false };

  if (intent.filters.gender) {
    where.gender = intent.filters.gender;
  }

  if (context?.focus?.type === "office") {
    where.officeId = context.focus.id;
  }

  const hasMin = typeof intent.filters.tenure?.min === "number";
  const hasMax = typeof intent.filters.tenure?.max === "number";

  if (!hasMin && !hasMax) {
    return streamReply(
      "Please specify years of service (e.g. **more than 10 years**).",
      context,
      null
    );
  }

  const employees = await prisma.employee.findMany({
    where,
    select: {
      id: true,
      dateHired: true,
      latestAppointment: true,
      terminateDate: true,
      isArchived: true,
      employmentEvents: {
        where: { deletedAt: null },
        select: { type: true, occurredAt: true, deletedAt: true },
      },
    },
  });

  const count = employees.filter((employee) => {
    const tenure = computeTenure({
      dateHired: employee.dateHired,
      latestAppointment: employee.latestAppointment,
      terminateDate: employee.terminateDate,
      isArchived: employee.isArchived,
      employmentEvents: employee.employmentEvents,
    });

    if (hasMin && tenure.totalServiceYears < intent.filters.tenure.min) return false;
    if (hasMax && tenure.totalServiceYears > intent.filters.tenure.max) return false;
    return true;
  }).length;

  context = {
    ...context,
    lastCountQuery: {
      type: "tenure",
      where,
    },
  };

  return streamReply(
    `There are **${count} employees** matching that length of service.`,
    context,
    null,
    { canExport: true }
  );
}
