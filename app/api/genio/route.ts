import { prisma } from "@/lib/prisma";
import {
  buildEmployeeKnowledgeText,
  chunkText,
  loadEmployeesFromExcel,
  retrieveRelevantKnowledge,
} from "@/src/genio/load-knowledge";
import { NextResponse } from "next/server";
import { Gender } from "@prisma/client";
import OpenAI from "openai";
import { buildEmployeeAIContext, getEmployeesForAI } from "@/src/genio/ai-data";
import { resolveOffice } from "@/src/genio/resolve-office";
import { OFFICE_ALIASES } from "@/src/genio/office-aliases";


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});



/* ================= HELPERS ================= */

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/office/g, "")
    .replace(/management/g, "")
    .replace(/resources?/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function calculateAge(birthday: Date) {
  return Math.floor(
    (Date.now() - birthday.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  );
}

function streamReply(
  reply: string,
  context: any,
  viewProfileEmployeeId: string | null
) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      for (const char of reply) {
        controller.enqueue(encoder.encode(char));
        await new Promise((r) => setTimeout(r, 10));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain",
      "x-genio-context": JSON.stringify(context),
      "x-genio-meta": JSON.stringify(
        viewProfileEmployeeId ? { viewProfileEmployeeId } : {}
      ),
    },
  });
}

function extractField(block: string, label: string) {
  const match = block.match(new RegExp(`${label}: (.*)`));
  return match ? match[1].trim() : null;
}

function resolveOfficeWithAliases(
  question: string,
  offices: { id: string; name: string }[]
) {
  const q = normalize(question);

  for (const office of offices) {
    const officeNorm = normalize(office.name);

    // 1️⃣ direct name match
    if (q.includes(officeNorm)) {
      return office;
    }

    // 2️⃣ alias match (normalize aliases too)
    for (const [key, aliases] of Object.entries(OFFICE_ALIASES)) {
      if (normalize(key) !== officeNorm) continue;

      for (const alias of aliases) {
        if (q.includes(normalize(alias))) {
          return office;
        }
      }
    }
  }

  return null;
}


/* ================= POST ================= */

/* ================= POST ================= */

export async function POST(req: Request) {
  const { message, context } = await req.json();
  const question = message.toLowerCase();

  let newContext = context ?? {};
  let viewProfileEmployeeId: string | null = null;

  /* ============================================================
     WHO IS (STRICT)
     ============================================================ */
  if (question.startsWith("who is")) {
    const cleaned = question
      .replace("who is", "")
      .replace(/[^a-z\s]/gi, "")
      .trim();

    const parts = cleaned.split(/\s+/);
    if (parts.length < 2) {
      return streamReply("Please provide the employee’s full name.", newContext, null);
    }

    const firstName = parts[0];
    const lastName = parts[parts.length - 1];

    const employees = await prisma.employee.findMany({
      where: {
        isArchived: false,
        firstName: { contains: firstName, mode: "insensitive" },
        lastName: { equals: lastName, mode: "insensitive" },
      },
      include: {
        offices: true,
        employeeType: true,
      },
    });

    if (employees.length === 0) {
      return streamReply("I couldn’t find an employee with that name.", newContext, null);
    }

    if (employees.length > 1) {
      return streamReply(
        "I found multiple employees with that name. Please provide more details.",
        newContext,
        null
      );
    }

    const emp = employees[0];

    newContext = {
      ...newContext,
      lastEmployeeId: emp.id,
      lastOfficeId: emp.officeId,
      lastOfficeName: emp.offices.name,
    };

    return streamReply(
      `${emp.firstName} ${emp.lastName} is a **${emp.position}** assigned to **${emp.offices.name}**.`,
      newContext,
      emp.id
    );
  }

  /* ============================================================
     COUNT / STATS (PRISMA ONLY)
     ============================================================ */

  const isCountQuestion =
    question.includes("how many") ||
    question.includes("count") ||
    question.includes("number of") ||
    question.includes("total");

  if (!isCountQuestion) {
    return streamReply(
      "Please specify an employee, office, or ask a count-related question.",
      newContext,
      null
    );
  }

  /* ---------- Gender intent ---------- */
  const hasMale = question.includes("male");
  const hasFemale = question.includes("female");

  const wantsGenderDistribution =
    question.includes("gender") || (hasMale && hasFemale);

  const wantsSingleGender =
    (hasMale || hasFemale) && !wantsGenderDistribution;

  /* ---------- Employee type ---------- */
  const EMPLOYEE_TYPES = ["permanent", "casual", "job order"];
  const employeeTypeQuery = EMPLOYEE_TYPES.find((t) =>
    question.includes(t)
  );

  let employeeTypeId: string | undefined;
  if (employeeTypeQuery) {
    const type = await prisma.employeeType.findFirst({
      where: { name: { equals: employeeTypeQuery, mode: "insensitive" } },
    });
    employeeTypeId = type?.id;
  }

  /* ---------- Office resolution ---------- */
  const offices = await prisma.offices.findMany({
    select: { id: true, name: true },
  });

  let officeId: string | undefined;
  let officeName: string | undefined;

  const matchedOffice =
    resolveOfficeWithAliases(question, offices) ??
    resolveOffice(question, offices);

  if (matchedOffice) {
    officeId = matchedOffice.id;
    officeName = matchedOffice.name;

    newContext = {
      ...newContext,
      lastOfficeId: officeId,
      lastOfficeName: officeName,
    };
  } else if (question.includes("this office") && context?.lastOfficeId) {
    officeId = context.lastOfficeId;
    officeName = context.lastOfficeName;
  }

  /* ---------- WHERE CLAUSE ---------- */
  const where: any = {
    isArchived: false,
    ...(employeeTypeId && { employeeTypeId }),
    ...(officeId && { officeId }),
  };

  /* ============================================================
     SINGLE GENDER (TOP PRIORITY)
     ============================================================ */
  if (wantsSingleGender) {
    const gender = hasMale ? Gender.Male : Gender.Female;

    const count = await prisma.employee.count({
      where: { ...where, gender },
    });

    return streamReply(
      `There are **${count} ${gender === Gender.Male ? "male" : "female"}${
        employeeTypeQuery ? ` ${employeeTypeQuery}` : ""
      } employees**${officeName ? ` in ${officeName}` : ""}.`,
      newContext,
      null
    );
  }

  /* ============================================================
     GENDER DISTRIBUTION
     ============================================================ */
  if (wantsGenderDistribution) {
    const [male, female] = await Promise.all([
      prisma.employee.count({ where: { ...where, gender: Gender.Male } }),
      prisma.employee.count({ where: { ...where, gender: Gender.Female } }),
    ]);

    return streamReply(
      `Here is the gender distribution${
        officeName ? ` in ${officeName}` : ""
      }:\n\n**Male:** ${male}\n**Female:** ${female}`,
      newContext,
      null
    );
  }

  /* ============================================================
     EMPLOYEE TYPE BREAKDOWN
     ============================================================ */
  if (
    question.includes("employee type") ||
    question.includes("employee types")
  ) {
    const types = await prisma.employeeType.findMany({
      include: {
        _count: { select: { employee: true } },
      },
    });

    const lines = types.map(
      (t) => `**${t.name}:** ${t._count.employee}`
    );

    return streamReply(
      `Here is the employee type distribution:\n\n${lines.join("\n")}`,
      newContext,
      null
    );
  }

  /* ============================================================
     TOTAL COUNT (LAST)
     ============================================================ */
  const count = await prisma.employee.count({ where });

  return streamReply(
    `There are **${count} employees**${officeName ? ` in ${officeName}` : ""}.`,
    newContext,
    null
  );
}


/* ================= GET ================= */

export async function GET(
  req: Request,
  { params }: { params: { employeeId: string } }
) {
  const employee = await prisma.employee.findUnique({
    where: { id: params.employeeId },
    include: {
      images: true,
      employeeType: true,
      eligibility: true,
      offices: true,
      department: true,
    },
  });

  if (!employee) {
    return NextResponse.json(null, { status: 404 });
  }

  return NextResponse.json(employee);
}
