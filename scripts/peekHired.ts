import { config } from "dotenv";
config();
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const arg = process.argv.find(a => a.startsWith("--employeeId="));
if (!arg) {
  console.error("Pass --employeeId=...");
  process.exit(1);
}
const employeeId = arg.split("=")[1];

(async () => {
  const emp = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, firstName: true, lastName: true, dateHired: true },
  });

  if (!emp) {
    console.log("No employee found.");
    process.exit(0);
  }

  const events = await prisma.employmentEvent.findMany({
    where: { employeeId, type: "HIRED", deletedAt: null },
    orderBy: { occurredAt: "asc" },
    select: { id: true, occurredAt: true, details: true },
  });

  console.log({
    employee: {
      id: emp.id,
      name: `${emp.firstName} ${emp.lastName}`,
      dateHiredISO: emp.dateHired?.toISOString(),
    },
    events: events.map(e => ({
      id: e.id,
      details: e.details,
      occurredAtISO: e.occurredAt.toISOString(),
    })),
  });

  await prisma.$disconnect();
})();
