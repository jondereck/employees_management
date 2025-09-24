import { config } from "dotenv"; config();
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const id = process.argv.find(a => a.startsWith("--employeeId="))?.split("=")[1];
if (!id) { console.error("Pass --employeeId=..."); process.exit(1); }

(async () => {
  const ev = await prisma.employmentEvent.findMany({
    where: { employeeId: id, type: "HIRED", deletedAt: null },
    orderBy: { occurredAt: "asc" },
    select: { id: true, occurredAt: true, details: true },
  });
  console.log(ev.map(e => ({ ...e, occurredAtISO: e.occurredAt.toISOString() })));
  await prisma.$disconnect();
})();
