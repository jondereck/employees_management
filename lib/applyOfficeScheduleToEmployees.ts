import { Prisma } from "@prisma/client";

export type OfficeAppliedScheduleWriteData = Omit<
  Prisma.WorkScheduleUncheckedCreateInput,
  "id" | "employeeId"
>;

export async function applyOfficeScheduleToEmployees(
  tx: Prisma.TransactionClient,
  input: {
    departmentId: string;
    officeId: string;
    schedule: OfficeAppliedScheduleWriteData;
  }
) {
  const employees = await tx.employee.findMany({
    where: {
      departmentId: input.departmentId,
      officeId: input.officeId,
      isArchived: false,
    },
    select: { id: true },
    orderBy: { lastName: "asc" },
  });

  let count = 0;
  for (const employee of employees) {
    const existing = await tx.workSchedule.findFirst({
      where: {
        employeeId: employee.id,
        effectiveFrom: input.schedule.effectiveFrom,
      },
      select: { id: true },
    });

    if (existing) {
      await tx.workSchedule.update({
        where: { id: existing.id },
        data: input.schedule,
      });
    } else {
      await tx.workSchedule.create({
        data: {
          ...input.schedule,
          employeeId: employee.id,
        },
      });
    }
    count += 1;
  }

  return count;
}
