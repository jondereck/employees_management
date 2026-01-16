import { prisma } from "@/lib/prisma";
import { chunkText, loadGenioKnowledge, retrieveRelevantKnowledge } from "@/src/genio/load-knowledge";


export async function POST(req: Request) {
  const { message, context } = await req.json();
  const question = message.toLowerCase();

  let reply = "";
  let newContext = context ?? {};

  /* ================= FOLLOW-UP ================= */
  const isWhoAreThey =
    question.includes("who are they") ||
    question.includes("who are those");

  if (isWhoAreThey && context?.employeeTypeId && context?.year) {
    const startDate = new Date(context.year, 0, 1);
    const endDate = new Date(context.year, 11, 31, 23, 59, 59);

    const employees = await prisma.employee.findMany({
      where: {
        employeeTypeId: context.employeeTypeId,
        isArchived: false,
        dateHired: { gte: startDate, lte: endDate },
      },
      select: {
        firstName: true,
        lastName: true,
        position: true,
      },
      orderBy: { lastName: "asc" },
    });

    reply =
      employees.length === 0
        ? "No employees found."
        : `Here are the ${context.employeeTypeName} employees hired in ${context.year}:\n\n` +
          employees
            .map(
              (e, i) =>
                `${i + 1}. ${e.firstName} ${e.lastName} – ${e.position}`
            )
            .join("\n");
  }

  /* ================= COUNT ================= */
  else {
    const yearMatch = question.match(/\b(20\d{2})\b/);
    const year = yearMatch ? Number(yearMatch[1]) : null;

    const EMPLOYEE_TYPES = ["permanent", "contractual", "probationary"];
    const employeeTypeQuery = EMPLOYEE_TYPES.find((t) =>
      question.includes(t)
    );

    if (employeeTypeQuery && year) {
      const employeeType = await prisma.employeeType.findFirst({
        where: {
          name: {
            equals: employeeTypeQuery,
            mode: "insensitive",
          },
        },
      });

      if (employeeType) {
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31, 23, 59, 59);

        const count = await prisma.employee.count({
          where: {
            employeeTypeId: employeeType.id,
            isArchived: false,
            dateHired: { gte: startDate, lte: endDate },
          },
        });

        reply = `There are ${count} ${employeeType.name.toUpperCase()} employees hired in ${year}.`;

        newContext = {
          employeeTypeId: employeeType.id,
          employeeTypeName: employeeType.name.toUpperCase(),
          year,
        };
      }
    }
  }

  /* ================= KNOWLEDGE (RAG PHASE 1) ================= */
  if (!reply) {
    const knowledgeText = await loadGenioKnowledge();
    console.log("GENIO KNOWLEDGE RAW:", knowledgeText.slice(0, 300));
    const chunks = chunkText(knowledgeText);

    const relevantKnowledge = retrieveRelevantKnowledge(
      chunks,
      message
    );

    if (relevantKnowledge.length > 0) {
      reply =
        `Based on internal records:\n\n` +
        relevantKnowledge.join("\n\n");
    }
  }

  /* ================= FALLBACK ================= */
  if (!reply) {
    reply = "Please specify an employee type, year, or ask about employee records.";
  }
if (!reply || typeof reply !== "string") {
  reply = "I couldn’t find relevant information.";
}

  /* ================= STREAM ================= */
const encoder = new TextEncoder();

const stream = new ReadableStream({
  async start(controller) {
    try {
      for (const char of reply) {
        controller.enqueue(encoder.encode(char));
        await new Promise((r) => setTimeout(r, 15));
      }
    } catch (err) {
      controller.enqueue(
        encoder.encode("An error occurred while generating the response.")
      );
    } finally {
      controller.close(); // 🔥 GUARANTEED
    }
  },
});

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain",
      "x-genio-context": JSON.stringify(newContext),
    },
  });
}
