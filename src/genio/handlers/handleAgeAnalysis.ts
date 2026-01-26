import { prisma } from "@/lib/prisma";
import { streamReply } from "../utils";

function getBirthdateFromAge(age: number) {
  const date = new Date();
  date.setFullYear(date.getFullYear() - age);
  return date;
}

export async function handleAgeAnalysis(
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

  const hasMin = typeof intent.filters.age?.min === "number";
  const hasMax = typeof intent.filters.age?.max === "number";

  if (!hasMin && !hasMax) {
    return streamReply(
      "Please specify an age (e.g. **above 40**, **below 30**).",
      context,
      null
    );
  }

  if (hasMin) {
    where.birthday = {
      ...(where.birthday || {}),
      lte: getBirthdateFromAge(intent.filters.age.min),
    };
  }

  if (hasMax) {
    where.birthday = {
      ...(where.birthday || {}),
      gte: getBirthdateFromAge(intent.filters.age.max + 1),
    };
  }

  const count = await prisma.employee.count({ where });

  context = {
    ...context,
    lastCountQuery: {
      type: "age",
      where,
    },
  };

  const label = hasMin && hasMax
    ? `between ${intent.filters.age.min} and ${intent.filters.age.max}`
    : hasMin
    ? `above ${intent.filters.age.min}`
    : `below ${intent.filters.age.max}`;

  return streamReply(
    `There are **${count} employees** aged **${label}**.`,
    context,
    null,
    { canExport: true }
  );
}
