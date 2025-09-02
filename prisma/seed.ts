import { salarySchedule } from "../utils/salarySchedule";
import { PrismaClient } from "@prisma/client";


const prisma = new PrismaClient();

async function main() {
  for (const item of salarySchedule) {
    for (let i = 0; i < item.steps.length; i++) {
      await prisma.salary.upsert({
        where: {
          grade_step: {
            grade: item.grade,
            step: i + 1,
          },
        },
        update: {
          amount: item.steps[i],
        },
        create: {
          grade: item.grade,
          step: i + 1,
          amount: item.steps[i],
        },
      });
    }
  }

  console.log("✅ Salary schedule seeded ");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
