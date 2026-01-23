import { prisma } from "@/lib/prisma";
import { streamReply } from "../utils";
import { resolveEmployeeType } from "../resolve-employee-type";
import { resolveOfficeWithAliases } from "../resolve-office";
import { Gender } from "@prisma/client";
import { GenioIntent } from "../type";
import { suggestOffices } from "../suggest-office";

export async function handleCount(
  intent: GenioIntent,
  context: any,
  message: string
) {
  const where: any = { isArchived: false };

/* ===============================
   OFFICE (AUTO-APPLY SINGLE SUGGESTION ✅)
   =============================== */
const offices = await prisma.offices.findMany({
  select: { id: true, name: true },
});

let office = resolveOfficeWithAliases(message, offices);

// 🔁 AUTO-SUGGEST FLOW
if (!office) {
  const suggestions = suggestOffices(message, offices);

  // ✅ AUTO-APPLY if only ONE suggestion
  if (suggestions.length === 1) {
    office = suggestions[0];

    context = {
      ...context,
      autoAppliedOffice: office.name,
      focus: {
        type: "office",
        id: office.id,
        name: office.name,
      },
    };
  }

  // ❓ MULTIPLE suggestions → ask user
  else if (suggestions.length > 1) {
    const list = suggestions
      .map((o, i) => `${i + 1}. ${o.name}`)
      .join("\n");

    return streamReply(
      `I couldn’t clearly identify the office you meant.\n\nDid you mean one of these?\n\n${list}\n\nYou can reply with the office name.`,
      context,
      null
    );
  }

  // ❌ No suggestions
  else {
    return streamReply(
      "I couldn’t identify the office.\nYou can say **“list all offices”** to see available options.",
      context,
      null
    );
  }
}

// ✅ Apply office filter
where.officeId = office.id;



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

  /* ===============================
     GENDER
     =============================== */
  if (intent.filters.gender) {
    where.gender =
      intent.filters.gender === "Male"
        ? Gender.Male
        : Gender.Female;
  }

  /* ===============================
     EMPLOYEE TYPE (SAFE & CORRECT)
     =============================== */
  if (intent.filters.employeeType) {
    // Resolve employeeType ONLY among employees in this office
    const employeeTypesInOffice = await prisma.employee.findMany({
      where: {
        ...where,
        officeId: where.officeId,
      },
      select: {
        employeeType: {
          select: { id: true, name: true, value: true },
        },
      },
    });

    const uniqueTypes = Array.from(
      new Map(
        employeeTypesInOffice
          .map((e) => e.employeeType)
          .filter(Boolean)
          .map((t) => [t.id, t])
      ).values()
    );

    const matchedType = resolveEmployeeType(
      intent.filters.employeeType,
      uniqueTypes
    );

    if (!matchedType) {
      return streamReply(
        `I couldn’t find a "${intent.filters.employeeType}" employee type in that office.`,
        context,
        null
      );
    }

    where.employeeTypeId = matchedType.id;
  }

  /* ===============================
     DEBUG (KEEP THIS)
     =============================== */
  console.log("GENIO COUNT FILTER:", where);

  /* ===============================
     COUNT
     =============================== */
  const count = await prisma.employee.count({ where });

  context = {
    ...context,
    lastQuery: { type: "count", where },
  };

  const autoOfficeNote = context?.autoAppliedOffice
  ? `*Assuming you meant **${context.autoAppliedOffice}***\n\n`
  : "";

  return streamReply(
  `${autoOfficeNote}There are **${count} employees** in ${office.name}.`,
  context,
  null
);

}
