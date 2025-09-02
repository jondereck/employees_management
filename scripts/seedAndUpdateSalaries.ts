
// # Make sure DB is in sync
// npx prisma generate
// npx prisma db push

// # Run unified seed
// npm run seed:all
import ora from "ora";
import { PrismaClient } from "@prisma/client";
import { salarySchedule } from "../utils/salarySchedule";

const prisma = new PrismaClient();

async function upsertSalaries() {
  const spinner = ora("Seeding salary table...").start();

  for (const { grade, steps } of salarySchedule) {
    for (let i = 0; i < steps.length; i++) {
      await prisma.salary.upsert({
        where: { grade_step: { grade, step: i + 1 } },
        update: { amount: steps[i] },
        create: { grade, step: i + 1, amount: steps[i] },
      });
    }
    spinner.text = `Seeding salary table... (done SG ${grade})`;
  }

  spinner.succeed("✅ Salary table upserted.");
}

async function updateEmployeeSalaries() {
  const spinner = ora("Updating employee salaries...").start();

  const employees = await prisma.employee.findMany({
    select: { id: true, salaryGrade: true, salaryStep: true },
  });

  let updatedCount = 0;
  const BATCH = 100;

  const ops: ReturnType<typeof prisma.employee.update>[] = [];
  for (const emp of employees) {
    const grade = emp.salaryGrade ?? 0;
    const step = emp.salaryStep ?? 0;
    if (grade <= 0 || step <= 0) continue;

    const sal = await prisma.salary.findUnique({
      where: { grade_step: { grade, step } },
      select: { amount: true },
    });
    if (!sal) continue;

    ops.push(
      prisma.employee.update({
        where: { id: emp.id },
        data: { salary: sal.amount },
      })
    );
  }

  for (let i = 0; i < ops.length; i += BATCH) {
    await prisma.$transaction(ops.slice(i, i + BATCH));
    updatedCount += Math.min(BATCH, ops.length - i);
    spinner.text = `Updating employee salaries... (${updatedCount}/${ops.length})`;
  }

  spinner.succeed(`✅ Updated ${updatedCount} employee salaries.`);
}


async function main() {
  await upsertSalaries();
  await updateEmployeeSalaries();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌ Failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
