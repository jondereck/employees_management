import { prisma } from "@/lib/prisma";
import { formatEmployees, streamReply } from "../utils";
import { GenioIntent } from "../type";


export async function handleWhoIs(
  message: string,
  context: any,
  intent?: GenioIntent
) {
  const raw =
    intent?.filters?.name ??
    message
      .toLowerCase()
      .replace(
        /who is|who are|tell me about|sino si|impormasyon ni|who's|whos/gi,
        ""
      )
      .trim();

  if (!raw) {
    return streamReply(
      "Please provide an employee name or employee number.",
      context,
      null
    );
  }


  
  /* ===============================
   EMPLOYEE NUMBER LOOKUP
   =============================== */

const employeeNumbers = raw.match(/\b\d{6,10}\b/g);
console.log("RAW:", raw);
console.log("EMPLOYEE NUMBERS:", employeeNumbers);

if (employeeNumbers && employeeNumbers.length > 0) {
  const isMultiNumberQuery = employeeNumbers.length > 1;

  const employees = await prisma.employee.findMany({
    where: {
      isArchived: false,
      OR: employeeNumbers.map((num) => ({
        employeeNo: {
          equals: num, // ✅ IMPORTANT FIX
        },
      })),
    },
    include: {
      offices: true,
      employeeType: true,
    },
  });
console.log("EMPLOYEES FOUND:", employees.map(e => e.employeeNo));
console.log("EMPLOYEES COUNT:", employees.length);

  if (employees.length === 0) {
    return streamReply(
      "I couldn’t find any employees with the provided employee number(s).",
      context,
      null
    );
  }

  // ✅ Multi-number query but only ONE match
if (isMultiNumberQuery && employees.length === 1) {
  const emp = employees[0];

  context = {
    ...context,
    lastListQuery: {
      type: "employee_lookup",
      where: {
        id: { in: [emp.id] },
      },
    },
  };

  return streamReply(
    `I found **one** employee matching the provided numbers:\n\n` +
      `${emp.employeeNo} – ${emp.firstName} ${emp.lastName} (${emp.offices?.name})`,
    context,
    null,
    { canExport: true }
  );
}

  // 🔹 Multiple employees → list + export
  if (employees.length > 1) {
    const list = employees
      .map(
        (e, i) =>
          `${i + 1}. ${e.employeeNo} – ${e.firstName} ${e.lastName} (${e.offices?.name})`
      )
      .join("\n");

    context = {
      ...context,
      lastListQuery: {
        type: "employee_lookup",
        where: {
          id: {
            in: employees.map((e) => e.id),
          },
        },
      },
    };

    return streamReply(
      `Here are the employees you asked for:\n\n${list}`,
      context,
      null,
      { canExport: true }
    );
  }

  // 🔹 Single employee → profile
  const emp = employees[0];

  const noteText = emp.note
    ? `\n\n📝 **Note:** ${emp.note}`
    : "";

  context = {
    ...context,
    lastEmployeeId: emp.id,
    lastOfficeId: emp.officeId,
    lastOfficeName: emp.offices?.name,
  };

  return streamReply(
    `${emp.firstName} ${emp.lastName} (**${emp.employeeNo}**) is a **${emp.position}** in **${emp.offices?.name}**.${noteText}`,
    context,
    emp.id
  );
}

 /* ===============================
     NOTE-BASED LOOKUP (ABSOLUTE FIRST)
     =============================== */
  if (intent?.filters?.note) {
    const keywords = intent.filters.note
      .split(",")
      .map(k => k.trim())
      .filter(Boolean);

    const employees = await prisma.employee.findMany({
      where: {
        isArchived: false,
        OR: keywords.map(k => ({
          note: {
            contains: k,
            mode: "insensitive",
          },
        })),
      },
      include: {
        offices: true,
        employeeType: true,
      },
    });

    if (employees.length === 0) {
      return streamReply(
        `No employees found with notes containing **${keywords.join(", ")}**.`,
        context,
        null
      );
    }

    const list = employees
      .map(
        e =>
          `• ${e.firstName} ${e.lastName} — ${e.offices?.name ?? "No office"}`
      )
      .join("\n");

    context = {
      ...context,
      lastListQuery: {
        type: "note_search",
        where: {
          OR: keywords.map(k => ({
            note: { contains: k, mode: "insensitive" },
          })),
        },
      },
    };

    return streamReply(
      `Here are the employees with notes containing **${keywords.join(", ")}**:\n\n${list}`,
      context,
      null,
      { canExport: true }
    );
  }



  
  /* ===============================
   EMPLOYEE NO PREFIX LOOKUP (BIO*)
   =============================== */

if (intent?.filters?.employeeNoPrefix) {
  const prefix = intent.filters.employeeNoPrefix;

  const employees = await prisma.employee.findMany({
    where: {
      isArchived: false,
      employeeNo: {
        startsWith: prefix,
        mode: "insensitive",
      },
    },
    include: {
      offices: true,
      employeeType: true,
    },
  });

  if (employees.length === 0) {
    return streamReply(
      `No employees found with employee numbers starting with **${prefix}**.`,
      context,
      null
    );
  }

  const list = formatEmployees(employees, {
    style: "bullet",
    showOffice: true,
  });

  context = {
    ...context,
    lastListQuery: {
      type: "employee_no_prefix",
      where: {
        employeeNo: {
          startsWith: prefix,
          mode: "insensitive",
        },
      },
    },
  };

  return streamReply(
    `Here are the employees with employee numbers starting with **${prefix}**:\n\n${list}`,
    context,
    null,
    { canExport: true }
  );
}

  /* ===============================
     NAME-BASED LOOKUP
     =============================== */

  const cleaned = raw.replace(/[^a-z\s]/g, "").trim();
  const tokens = cleaned.split(/\s+/).filter(Boolean);

  const employees = await prisma.employee.findMany({
    where: {
      isArchived: false,
      AND: tokens.map((token) => ({
        OR: [
          { firstName: { contains: token, mode: "insensitive" } },
          { middleName: { contains: token, mode: "insensitive" } },
          { lastName: { contains: token, mode: "insensitive" } },
          { nickname: { contains: token, mode: "insensitive" } },
        ],
      })),
    },
    include: {
      offices: true,
      employeeType: true,
    },
  });

  if (employees.length === 0) {
    return streamReply(
      `I couldn’t find an employee named **${cleaned}**.`,
      context,
      null
    );
  }

  if (employees.length > 1) {
    const list = employees
      .slice(0, 5)
      .map(
        (e) =>
          `• ${e.firstName} ${e.middleName} ${e.lastName}`.replace(
            /\s+/g,
            " "
          )
      )
      .join("\n");

    return streamReply(
      `I found multiple employees matching **${cleaned}**. Who do you mean?\n\n${list}`,
      context,
      null
    );
  }

  const emp = employees[0];

  const noteText = emp.note
    ? `\n\n📝 **Note:** ${emp.note}`
    : "";

  context = {
    ...context,
    lastEmployeeId: emp.id,
    lastOfficeId: emp.officeId,
    lastOfficeName: emp.offices?.name,
  };

  return streamReply(
    `${emp.firstName} ${emp.lastName} is a **${emp.position}** in **${emp.offices?.name}**.${noteText}`,
    context,
    emp.id
  );
}
