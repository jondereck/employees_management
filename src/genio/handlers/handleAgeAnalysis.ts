import { prisma } from "@/lib/prisma";
import { streamReply } from "../utils";
import { Gender } from "@prisma/client";

/**
 * Returns a date representing "today - age years"
 */
function birthdateFromAge(age: number) {
  const today = new Date();
  const d = new Date(today);
  d.setFullYear(today.getFullYear() - age);
  return d;
}

export async function handleAgeAnalysis(
  intent: any,
  context: any
) {
  const where: any = { isArchived: false };

  const exactAge =
    typeof intent.filters.age?.exact === "number"
      ? intent.filters.age.exact
      : null;

  const minAge =
    typeof intent.filters.age?.min === "number"
      ? intent.filters.age.min
      : null;

  const maxAge =
    typeof intent.filters.age?.max === "number"
      ? intent.filters.age.max
      : null;

  if (exactAge === null && minAge === null && maxAge === null) {
    return streamReply(
      "Please specify an age or range (e.g. **above 40**, **below 30**, **25 to 35**, **aged 30**).",
      context,
      null
    );
  }

  if (intent.filters.gender) {
    where.gender =
      intent.filters.gender === "Male"
        ? Gender.Male
        : Gender.Female;
  }

  if (context?.focus?.type === "office") {
    where.officeId = context.focus.id;
  }

  const today = new Date();
  const birthdayFilter: any = {};

  if (exactAge !== null) {
    const maxBirthDate = new Date(today);
    maxBirthDate.setFullYear(today.getFullYear() - exactAge);

    const minBirthDate = new Date(today);
    minBirthDate.setFullYear(today.getFullYear() - exactAge - 1);

    birthdayFilter.lte = maxBirthDate;
    birthdayFilter.gt = minBirthDate;
  } else {
    if (minAge !== null) {
      const maxBirthDate = new Date(today);
      maxBirthDate.setFullYear(today.getFullYear() - minAge);
      birthdayFilter.lte = maxBirthDate;
    }

    if (maxAge !== null) {
      const minBirthDate = new Date(today);
      minBirthDate.setFullYear(today.getFullYear() - maxAge);
      birthdayFilter.gte = minBirthDate;
    }
  }

  if (Object.keys(birthdayFilter).length > 0) {
    where.birthday = birthdayFilter;
  }

  const count = await prisma.employee.count({ where });

  let label = "";

  if (exactAge !== null) {
    label = `${exactAge} years old`;
  } else if (minAge !== null && maxAge !== null) {
    label = `between ${minAge} and ${maxAge}`;
  } else if (minAge !== null) {
    label = `${minAge} and above`;
  } else {
    label = `${maxAge} and below`;
  }

  context = {
    ...context,
    lastCountQuery: {
      type: "age",
      where,
      label,
    },
  };

  return streamReply(
    `There are **${count} employees** aged **${label}**.`,
    context,
    null,
    { canExport: true }
  );
}


