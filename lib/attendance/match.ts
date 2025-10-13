import prismadb from "@/lib/prismadb";
import { RawRecord, EmployeeMatch, UnmatchedBio } from "./types";

const normalizeId = (value: string) => value.replace(/[^0-9a-z]/gi, "").trim();

export async function matchEmployees(departmentId: string, raw: RawRecord[]) {
  const [mappings, employees] = await Promise.all([
    (prismadb as any).bioUserMap?.findMany?.({
      where: { departmentId },
      select: { bioUserId: true, employeeId: true },
    }) ?? [],
    prismadb.employee.findMany({
      where: { departmentId },
      select: {
        id: true,
        officeId: true,
        employeeNo: true,
        firstName: true,
        lastName: true,
        middleName: true,
        suffix: true,
      },
    }),
  ]);

  const employeesById = new Map(
    employees.map((employee) => [employee.id, employee])
  );

  const employeesByBioFallback = new Map(
    employees
      .map((employee) => ({
        key: normalizeId(employee.employeeNo ?? ""),
        employee,
      }))
      .filter((entry) => entry.key)
      .map((entry) => [entry.key, entry.employee])
  );

  const bioMap = new Map(
    (mappings ?? []).map((item: { bioUserId: string; employeeId: string }) => [normalizeId(item.bioUserId), item.employeeId])
  );

  const matched: EmployeeMatch[] = [];
  const unmatched: UnmatchedBio[] = [];

  raw.forEach((record) => {
    const normalizedBio = normalizeId(record.bioUserId);
    const mappedEmployeeId = bioMap.get(normalizedBio);
    let employee = mappedEmployeeId ? employeesById.get(mappedEmployeeId) : undefined;

    if (!employee && normalizedBio) {
      employee = employeesByBioFallback.get(normalizedBio);
    }

    if (!employee) {
      unmatched.push({
        bioUserId: record.bioUserId,
        name: record.name,
        officeHint: record.officeHint,
      });
      return;
    }

    matched.push({
      employeeId: employee.id,
      officeId: employee.officeId,
      bioUserId: record.bioUserId,
      days: record.punches.map((punch) => ({ date: punch.date, times: [...punch.times] })),
    });
  });

  return { matched, unmatched, employees };
}
