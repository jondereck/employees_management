import { prisma } from "@/lib/prisma";
import { streamReply } from "../utils";

function getHireDateFromYears(years: number) {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  return date;
}

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

if (hasMin) {
  where.dateHired = {
    ...(where.dateHired || {}),
    lte: getHireDateFromYears(intent.filters.tenure.min),
  };
}

if (hasMax) {
  where.dateHired = {
    ...(where.dateHired || {}),
    gte: getHireDateFromYears(intent.filters.tenure.max + 1),
  };
}


  const count = await prisma.employee.count({ where });

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
