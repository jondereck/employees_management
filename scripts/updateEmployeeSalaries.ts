// import { PrismaClient } from "@prisma/client";
const { PrismaClient } = require("@prisma/client");

const prismadb = new PrismaClient();

async function main() {
  const employees = await prismadb.employee.findMany();

  for (const emp of employees) {
    if (!emp.salaryGrade || !emp.salaryStep) continue;

    const salaryRecord = await prismadb.salary.findUnique({
      where: { grade_step: { grade: emp.salaryGrade, step: emp.salaryStep } },
    });

    if (!salaryRecord) continue;

    await prismadb.employee.update({
      where: { id: emp.id },
      data: { salary: salaryRecord.amount },
    });
  }

  console.log("✅ All employee salaries updated to the latest schedule");
}

main()
  .then(() => prismadb.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prismadb.$disconnect();
    process.exit(1);
  });
