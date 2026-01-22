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

/* ================= POST ================= */

export async function POST(req: Request) {
  const { message, context } = await req.json();
  const question = message.toLowerCase();

  let newContext = context ?? {};
  let viewProfileEmployeeId: string | null = null;

  /* ============================================================
     FOLLOW-UP: HOW OLD IS HE / SHE
     ============================================================ */

  const isHowOld =
    question.includes("how old") &&
    (question.includes("he") || question.includes("she"));

  if (isHowOld && context?.lastEmployeeId) {
    const employee = await prisma.employee.findUnique({
      where: { id: context.lastEmployeeId },
      select: {
        firstName: true,
        lastName: true,
        birthday: true,
        id: true,
      },
    });

    if (!employee || !employee.birthday) {
      return streamReply(
        "I don’t have the birthdate information for this employee.",
        newContext,
        null
      );
    }

    const age = calculateAge(employee.birthday);

    return streamReply(
      `${employee.firstName} ${employee.lastName} is **${age} years old**.`,
      newContext,
      employee.id
    );
  }

  /* ============================================================
   FLEXIBLE AI MODE (SAFE DB ACCESS)
   ============================================================ */

const flexibleQuestions =
  question.includes("oldest") ||
  question.includes("youngest") ||
  question.includes("department") ||
  question.includes("office") ||
  question.includes("works in") ||
  question.includes("most employees");

if (flexibleQuestions) {
  const employees = await getEmployeesForAI();
  const contextText = buildEmployeeAIContext(employees);

  const prompt = `
You are Genio, an HR assistant.


You may only explain results that are already computed.
Do NOT invent numbers or names.

Use ONLY the data below.
If the data is insufficient, say so.

${contextText}

Question:
${message}
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  return streamReply(
    completion.choices[0].message.content ?? "I couldn't determine the answer.",
    newContext,
    null
  );
}

  /* ============================================================
     COUNT QUESTIONS → PRISMA ONLY
     ============================================================ */

  const isCountQuestion =
    question.includes("how many") ||
    question.includes("count") ||
    question.includes("number of") ||
    question.includes("total");

  if (isCountQuestion) {
    const wantsMale = question.includes("male");
    const wantsFemale = question.includes("female");

    // Employee type
    const EMPLOYEE_TYPES = ["permanent", "casual", "job order"];
    const employeeTypeQuery = EMPLOYEE_TYPES.find((t) =>
      question.includes(t)
    );

    let employeeTypeId: string | undefined;

    if (employeeTypeQuery) {
      const employeeType = await prisma.employeeType.findFirst({
        where: { name: { equals: employeeTypeQuery, mode: "insensitive" } },
      });
      employeeTypeId = employeeType?.id;
    }

    // Office resolution
    const offices = await prisma.offices.findMany({
      select: { id: true, name: true },
    });

    const normalizedQuestion = normalize(question);

    const officeMatch = offices.find((o) =>
      normalize(o.name).includes(normalizedQuestion) ||
      normalizedQuestion.includes(normalize(o.name))
    );

    if (question.includes("office") && !officeMatch) {
      return streamReply(
        "I couldn’t identify which office you mean. Please use the full office name.",
        newContext,
        null
      );
    }

    const where: any = {
      isArchived: false,
      ...(employeeTypeId && { employeeTypeId }),
      ...(officeMatch && { officeId: officeMatch.id }),
    };

    // Male + Female
    if (wantsMale && wantsFemale) {
      const [male, female] = await Promise.all([
        prisma.employee.count({
          where: { ...where, gender: Gender.Male },
        }),
        prisma.employee.count({
          where: { ...where, gender: Gender.Female },
        }),
      ]);

      return streamReply(
        `Here is the gender distribution${
          officeMatch ? ` in ${officeMatch.name}` : ""
        }:\n\n**Male:** ${male}\n**Female:** ${female}`,
        newContext,
        null
      );
    }

    // Single gender
    if (wantsMale || wantsFemale) {
      const gender = wantsMale ? Gender.Male : Gender.Female;

      const count = await prisma.employee.count({
        where: { ...where, gender },
      });

      return streamReply(
        `There are **${count} ${
          wantsMale ? "male" : "female"
        } employees**${officeMatch ? ` in ${officeMatch.name}` : ""}.`,
        newContext,
        null
      );
    }

    // Total
    const count = await prisma.employee.count({ where });

    return streamReply(
      `There are **${count} employees**${
        officeMatch ? ` in ${officeMatch.name}` : ""
      }.`,
      newContext,
      null
    );
  }

  /* ============================================================
     WHO IS → EXCEL + AI (STORE CONTEXT)
     ============================================================ */

  if (question.startsWith("who is")) {
    const employees = loadEmployeesFromExcel();
    const knowledgeText = buildEmployeeKnowledgeText(employees);
    const chunks = knowledgeText.split("\n---\n");

    const tokens = question
      .toUpperCase()
      .replace("WHO IS", "")
      .replace(/[^A-Z\s]/g, "")
      .trim()
      .split(" ");

    const matches = chunks.filter((chunk) =>
      tokens.every((t:string) => chunk.toUpperCase().includes(t))
    );

    if (matches.length > 0) {
      const prompt = `
You are Genio, an HR assistant.
Use ONLY the employee record below.

Employee Record:
${matches[0]}

Question:
${message}
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      });

      // Match employee in Prisma for follow-ups
      const fullName = extractField(matches[0], "Name");
      const parts = fullName?.split(" ") ?? [];

      const firstName = parts[0];
      const lastName = parts[parts.length - 1];

      const prismaEmployee = await prisma.employee.findFirst({
        where: {
          firstName: { contains: firstName, mode: "insensitive" },
          lastName: { contains: lastName, mode: "insensitive" },
          isArchived: false,
        },
        select: { id: true },
      });

      if (prismaEmployee) {
        newContext = {
          ...newContext,
          lastEmployeeId: prismaEmployee.id,
        };
      }

return streamReply(
  completion.choices[0].message.content ??
    "I couldn’t interpret the employee record.",
  newContext,
  prismaEmployee?.id ?? null
);

    }
  }

  /* ============================================================
     FALLBACK
     ============================================================ */

  return streamReply(
    "Please specify an employee, office, or ask a count-related question.",
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
