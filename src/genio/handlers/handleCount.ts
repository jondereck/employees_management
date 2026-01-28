import { prisma } from "@/lib/prisma";
import { streamReply } from "../utils";
import {
  resolveEmployeeType,
  extractEmployeeTypeKeyword,
} from "../resolve-employee-type";
import { resolveOfficeWithAliases } from "../resolve-office";
import { Gender } from "@prisma/client";
import { GenioIntent } from "../type";
import { suggestOffices } from "../suggest-office";
import { handleAgeAnalysis } from "./handleAgeAnalysis";

export async function handleCount(
  intent: GenioIntent,
  context: any,
  message: string
) {
  /* ===============================
     🚨 AGE → DELEGATE EARLY
     =============================== */
  const hasAgeFilter =
    typeof intent.filters.age?.min === "number" ||
    typeof intent.filters.age?.max === "number";

  if (hasAgeFilter) {
    return handleAgeAnalysis(intent, context);
  }

  const where: any = { isArchived: false };

  /* ===============================
     ✅ GENDER (ALWAYS APPLY)
     =============================== */
  if (intent.filters.gender) {
    where.gender =
      intent.filters.gender === "Male"
        ? Gender.Male
        : Gender.Female;
  } else {
    const genderFromText =
      /\b(female|women|woman|girls?)\b/i.test(message)
        ? Gender.Female
        : /\b(male|men|man|boys?)\b/i.test(message)
        ? Gender.Male
        : null;

    if (genderFromText) {
      where.gender = genderFromText;
    }
  }

  /* ===============================
     ✅ OFFICE
     =============================== */
  const mentionsOffice =
    /office|department|division|unit|section|in\s+|sa\s+/i.test(message);

  let office =
    context?.lastCountQuery?.officeId && !mentionsOffice
      ? {
          id: context.lastCountQuery.officeId,
          name: context.lastCountQuery.officeName,
        }
      : null;

  if (mentionsOffice) {
    const offices = await prisma.offices.findMany({
      select: { id: true, name: true },
    });

    office = resolveOfficeWithAliases(message, offices);

    if (!office) {
      const suggestions = suggestOffices(message, offices);

      if (suggestions.length === 1) {
        office = suggestions[0];
      } else if (suggestions.length > 1) {
        return streamReply(
          `Which office did you mean?\n\n${suggestions
            .map((o) => `• ${o.name}`)
            .join("\n")}`,
          context,
          null
        );
      } else {
        return streamReply(
          "I couldn’t identify the office.",
          context,
          null
        );
      }
    }
  }

  if (office) {
    where.officeId = office.id;
  }

  /* ===============================
     ✅ EMPLOYEE TYPE (SMART)
     =============================== */
  const rawEmployeeTypeText =
    intent.filters.employeeType ??
    extractEmployeeTypeKeyword(message);

  if (rawEmployeeTypeText) {
    const employeeTypes = await prisma.employeeType.findMany({
      select: { id: true, name: true, value: true },
    });

    const matchedType = resolveEmployeeType(
      rawEmployeeTypeText,
      employeeTypes
    );

    // ✅ apply ONLY if valid
    if (matchedType) {
      where.employeeTypeId = matchedType.id;
    }
  }

  /* ===============================
     ✅ COUNT
     =============================== */
  let reply = "";

  if (!where.gender) {
    const [total, male, female] = await Promise.all([
      prisma.employee.count({ where }),
      prisma.employee.count({
        where: { ...where, gender: Gender.Male },
      }),
      prisma.employee.count({
        where: { ...where, gender: Gender.Female },
      }),
    ]);

    reply =
      `There are **${total} employees**` +
      (office ? ` in **${office.name}**` : "") +
      `.\n\n• **${male} male**\n• **${female} female**`;
  } else {
    const count = await prisma.employee.count({ where });

    reply =
      `There are **${count} ${
        where.gender === Gender.Male ? "male" : "female"
      } employees**` +
      (office ? ` in **${office.name}**` : "");
  }

  /* ===============================
     SAVE CONTEXT
     =============================== */
  context = {
    ...context,
    lastCountQuery: {
      officeId: office?.id,
      officeName: office?.name,
      employeeTypeId: where.employeeTypeId,
      gender: where.gender,
      where,
    },
  };

  return streamReply(reply, context, null, { canExport: true });
}
