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

  if (employees.length === 0) {
    return 0;
  }

  const employeeIds = employees.map((employee) => employee.id);
  const existingSchedules = await tx.workSchedule.findMany({
    where: {
      employeeId: { in: employeeIds },
      effectiveFrom: input.schedule.effectiveFrom,
    },
    select: { id: true, employeeId: true },
  });

  if (existingSchedules.length > 0) {
    await tx.workSchedule.updateMany({
      where: { id: { in: existingSchedules.map((schedule) => schedule.id) } },
      data: input.schedule,
    });
  }

  const existingEmployeeIds = new Set(
    existingSchedules.map((schedule) => schedule.employeeId)
  );
  const createData = employees
    .filter((employee) => !existingEmployeeIds.has(employee.id))
    .map((employee) => ({
      ...input.schedule,
      employeeId: employee.id,
    }));

  if (createData.length > 0) {
    await tx.workSchedule.createMany({ data: createData });
  }

  return employees.length;
}
