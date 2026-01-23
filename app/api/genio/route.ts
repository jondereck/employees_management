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
import { parseGenioIntent } from "@/src/genio/parse-intent";


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

async function countWithAgeFilter(where: any, ageFilter: { min?: number; max?: number }) {
  const employees = await prisma.employee.findMany({
    where,
    select: { birthday: true },
  });

  return employees.filter((e) => {
    if (!e.birthday) return false;

    const age = calculateAge(e.birthday);

    if (ageFilter.min !== undefined && age < ageFilter.min) return false;
    if (ageFilter.max !== undefined && age > ageFilter.max) return false;

    return true;
  }).length;
}



/* ================= POST ================= */

export async function POST(req: Request) {
  const { message, context } = await req.json();
  const question = message.toLowerCase();
const intent = await parseGenioIntent(message);

  let newContext = context ?? {};

 /* ============================================================
     FOLLOW-UP: "WHO ARE THEY?"
     ============================================================ */
  const isWhoAreThey =
    /\bwho are they\b/.test(question) ||
    /\blist them\b/.test(question) ||
    /\bshow them\b/.test(question);

  if (isWhoAreThey) {
    if (!context?.lastQuery) {
      return streamReply(
        "Please ask a count question first (e.g. 'How many employees hired this year?').",
        newContext,
        null
      );
    }

    const { where, ageFilter } = context.lastQuery;

    let employees;

    if (ageFilter) {
      const all = await prisma.employee.findMany({
        where,
        select: { firstName: true, lastName: true, birthday: true },
        take: 20,
      });

      employees = all.filter((e) => {
        const age = calculateAge(e.birthday);
        if (ageFilter.min && age < ageFilter.min) return false;
        if (ageFilter.max && age > ageFilter.max) return false;
        return true;
      });
    } else {
      employees = await prisma.employee.findMany({
        where,
        select: { firstName: true, lastName: true },
        take: 20,
      });
    }

    if (!employees.length) {
      return streamReply("I couldn’t find any employees.", newContext, null);
    }

    const names = employees
      .map((e, i) => `${i + 1}. ${e.firstName} ${e.lastName}`)
      .join("\n");

    return streamReply(`Here they are:\n\n${names}`, newContext, null);
  }


  
  /* ============================================================
   AGE INTENT
   ============================================================ */

let ageFilter: { min?: number; max?: number } | null = null;

const ageMatch =
  question.match(/age\s*(\d+)/) ||
  question.match(/above\s*(\d+)/) ||
  question.match(/older than\s*(\d+)/) ||
  question.match(/below\s*(\d+)/) ||
  question.match(/younger than\s*(\d+)/);

if (ageMatch) {
  const age = parseInt(ageMatch[1]);

  if (/below|younger/.test(question)) {
    ageFilter = { max: age - 1 };
  } else {
    ageFilter = { min: age };
  }
}

/* ============================================================
   HIRED THIS YEAR INTENT
   ============================================================ */

const wantsHiredThisYear =
  /\bhired this year\b/.test(question) ||
  /\bemployed this year\b/.test(question);

let hiredDateFilter: { gte: Date; lt: Date } | null = null;

if (wantsHiredThisYear) {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const startNextYear = new Date(now.getFullYear() + 1, 0, 1);

  hiredDateFilter = {
    gte: startOfYear,
    lt: startNextYear,
  };
}

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
  intent.action === "count" ||
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

/* ---------- SAFE gender detection (WORD-BOUNDARY) ---------- */
const hasMale = /\bmale\b/.test(question);
const hasFemale = /\bfemale\b/.test(question);

const wantsGenderDistribution =
  intent.filters.gender === undefined &&
  question.includes("gender");

const wantsSingleGender =
  intent.filters.gender !== undefined;


/* ---------- Employee Type (DB-driven) ---------- */
const employeeTypes = await prisma.employeeType.findMany({
  select: { id: true, name: true, value: true },
});

let employeeTypeId: string | undefined;
let employeeTypeName: string | undefined;

const normalizedQuestion = question
  .replace(/[^a-z\s]/gi, "")
  .toLowerCase();

for (const type of employeeTypes) {
  const candidates = [
    type.name,
    type.value,
  ]
    .filter(Boolean)
    .map(v => v.toLowerCase());

  if (candidates.some(v => normalizedQuestion.includes(v))) {
    employeeTypeId = type.id;
    employeeTypeName = type.name;
    break;
  }
}

const employeeTypeQuery = employeeTypeName

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

/* ---------- WHERE clause ---------- */
const where: any = {
  isArchived: false,
  ...(employeeTypeId && { employeeTypeId }),
  ...(officeId && { officeId }),
  ...(hiredDateFilter && { dateHired: hiredDateFilter }),
};

if (intent.filters.employeeType) {
  const matched = employeeTypes.find((t) =>
    t.name.toLowerCase().includes(
      intent.filters.employeeType!.toLowerCase()
    )
  );

  if (matched) {
    where.employeeTypeId = matched.id;
  }
}

/* ============================================================
   APPLY OPENAI INTENT FILTERS
   ============================================================ */

// Gender
if (intent.filters.gender) {
  where.gender =
    intent.filters.gender === "Male"
      ? Gender.Male
      : Gender.Female;
}

// Office (reuse existing resolver)
if (intent.filters.office) {
  const office = resolveOfficeWithAliases(
    intent.filters.office,
    offices
  );
  if (office) {
    where.officeId = office.id;
  }
}

// Hired time
if (intent.filters.hired === "this_year") {
  const now = new Date();
  where.dateHired = {
    gte: new Date(now.getFullYear(), 0, 1),
    lt: new Date(now.getFullYear() + 1, 0, 1),
  };
}

if (intent.filters.hired === "recent") {
  const now = new Date();
  where.dateHired = {
    gte: new Date(now.setMonth(now.getMonth() - 6)),
  };
}


/* ============================================================
   SINGLE GENDER (HIGHEST PRIORITY)
   Example: "How many female casual employees in HR"
   ============================================================ */
if (wantsSingleGender && where.gender) {
  const gender = where.gender;

  const count = ageFilter
    ? await countWithAgeFilter(where, ageFilter)
    : await prisma.employee.count({ where });


newContext = {
  ...newContext,
  lastQuery: {
    where: {
      ...where,
      gender, // ✅ SAVE GENDER
    },
    ageFilter,
  },
};



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
   Example: "Show gender distribution in HR"
   ============================================================ */
if (wantsGenderDistribution) {
 const male = ageFilter
  ? await countWithAgeFilter({ ...where, gender: Gender.Male }, ageFilter)
  : await prisma.employee.count({ where: { ...where, gender: Gender.Male } });

const female = ageFilter
  ? await countWithAgeFilter({ ...where, gender: Gender.Female }, ageFilter)
  : await prisma.employee.count({ where: { ...where, gender: Gender.Female } });


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
   Example: "Show employee type count"
   ============================================================ */
if (
  question.includes("employee type") ||
  question.includes("employee types") ||
  question.includes("employment type")
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
   TOTAL COUNT (LAST FALLBACK)
   ============================================================ */
const count = ageFilter
  ? await countWithAgeFilter(where, ageFilter)
  : await prisma.employee.count({ where });

newContext = {
  ...newContext,
  lastQuery: {
    where,
    ageFilter,
    hiredDateFilter,
  },
};


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
