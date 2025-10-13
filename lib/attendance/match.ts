import prismadb from "@/lib/prismadb";
import { EmployeeMatch, RawRecord, UnmatchedRecord } from "./types";

export async function matchEmployees({
  departmentId,
  records,
}: {
  departmentId: string;
  records: RawRecord[];
}): Promise<{ matched: EmployeeMatch[]; unmatched: UnmatchedRecord[] }> {
  const [employees, mappings] = await Promise.all([
    prismadb.employee.findMany({
      where: { departmentId },
      select: {
        id: true,
        officeId: true,
      },
    }),
    prismadb.bioUserMap.findMany({
      where: { departmentId },
      select: { bioUserId: true, employeeId: true },
    }),
  ]);

  const employeeById = new Map(employees.map((emp) => [emp.id, emp]));
  const employeeByBio = new Map(mappings.map((map) => [map.bioUserId.trim(), map.employeeId]));

  const matched: EmployeeMatch[] = [];
  const unmatchedMap = new Map<string, UnmatchedRecord>();

  for (const record of records) {
    const mappedEmployeeId = employeeByBio.get(record.bioUserId.trim());
    if (!mappedEmployeeId) {
      unmatchedMap.set(record.bioUserId, {
        bioUserId: record.bioUserId,
        name: record.name,
        officeHint: record.officeHint,
      });
      continue;
    }
    const employee = employeeById.get(mappedEmployeeId);
    if (!employee) {
      unmatchedMap.set(record.bioUserId, {
        bioUserId: record.bioUserId,
        name: record.name,
        officeHint: record.officeHint,
      });
      continue;
    }
    matched.push({
      employeeId: mappedEmployeeId,
      officeId: employee.officeId,
      bioUserId: record.bioUserId,
      days: record.punches.map((punch) => ({
        date: punch.date,
        times: [...punch.times],
      })),
    });
  }
  matched.sort((a, b) => a.employeeId.localeCompare(b.employeeId));
  const unmatched = Array.from(unmatchedMap.values()).sort((a, b) =>
    a.bioUserId.localeCompare(b.bioUserId)
  );

  return { matched, unmatched };
}
