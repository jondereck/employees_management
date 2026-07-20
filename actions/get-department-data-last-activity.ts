import prismadb from "@/lib/prismadb";

/**
 * Latest activity timestamp that affects Overview dashboard figures:
 * employee create/update/archive, change requests, and office records.
 * Permanent hard-deletes are not tracked (row is removed).
 */
export async function getDepartmentDataLastActivity(
  departmentId: string,
): Promise<Date | null> {
  const [employeeUpdated, employeeCreated, changeRequest, offices] = await Promise.all([
    prismadb.employee.aggregate({
      where: { departmentId },
      _max: { updatedAt: true },
    }),
    prismadb.employee.aggregate({
      where: { departmentId },
      _max: { createdAt: true },
    }),
    prismadb.changeRequest.aggregate({
      where: { departmentId },
      _max: { updatedAt: true },
    }),
    prismadb.offices.aggregate({
      where: { departmentId },
      _max: { updatedAt: true },
    }),
  ]);

  const candidates = [
    employeeUpdated._max.updatedAt,
    employeeCreated._max.createdAt,
    changeRequest._max.updatedAt,
    offices._max.updatedAt,
  ].filter((value): value is Date => value instanceof Date);

  if (candidates.length === 0) return null;

  return new Date(Math.max(...candidates.map((value) => value.getTime())));
}
