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

  /* ===============================
     GENDER (optional)
     =============================== */
  if (intent.filters.gender) {
    where.gender =
      intent.filters.gender === "Male"
        ? Gender.Male
        : Gender.Female;
  }

  /* ===============================
     OFFICE CONTEXT (carry-over)
     =============================== */
  if (context?.focus?.type === "office") {
    where.officeId = context.focus.id;
  }

  /* ===============================
     AGE FILTERS
     =============================== */
  const minAge =
    typeof intent.filters.age?.min === "number"
      ? intent.filters.age.min
      : null;

  const maxAge =
    typeof intent.filters.age?.max === "number"
      ? intent.filters.age.max
      : null;

  if (minAge === null && maxAge === null) {
    return streamReply(
      "Please specify an age or range (e.g. **above 40**, **below 30**, **25 to 35**).",
      context,
      null
    );
  }

  /**
   * Age → birthday logic
   *
   * minAge = youngest allowed
   * maxAge = oldest allowed
   */
  if (minAge !== null) {
    // age >= minAge → birthday <= today - minAge
    where.birthday = {
      ...(where.birthday || {}),
      lte: birthdateFromAge(minAge),
    };
  }

  if (maxAge !== null) {
    // age <= maxAge → birthday >= today - (maxAge + 1)
    where.birthday = {
      ...(where.birthday || {}),
      gte: birthdateFromAge(maxAge + 1),
    };
  }

  /* ===============================
     COUNT
     =============================== */
  const count = await prisma.employee.count({ where });

  /* ===============================
     SAVE CONTEXT
     =============================== */
  context = {
    ...context,
    lastCountQuery: {
      type: "age",
      minAge,
      maxAge,
      where,
    },
  };

  /* ===============================
     RESPONSE LABEL
     =============================== */
  let label = "";

  if (minAge !== null && maxAge !== null) {
    label = `between ${minAge} and ${maxAge}`;
  } else if (minAge !== null) {
    label = `${minAge} and above`;
  } else {
    label = `${maxAge} and below`;
  }

  return streamReply(
    `There are **${count} employees** aged **${label}**.`,
    context,
    null,
    { canExport: true }
  );
}
