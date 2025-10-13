import prismadb from "@/lib/prismadb";
import { AttendanceClient } from "./components/client";
import { formatEmployeeName } from "@/lib/attendance/utils";

const AttendancePage = async ({
  params,
}: {
  params: { departmentId: string };
}) => {
  const [employees, offices] = await Promise.all([
    prismadb.employee.findMany({
      where: { departmentId: params.departmentId },
      orderBy: { lastName: "asc" },
      select: {
        id: true,
        prefix: true,
        firstName: true,
        middleName: true,
        lastName: true,
        suffix: true,
        officeId: true,
        offices: { select: { id: true, name: true } },
      },
    }),
    prismadb.offices.findMany({
      where: { departmentId: params.departmentId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const employeeOptions = employees.map((employee) => ({
    id: employee.id,
    name: formatEmployeeName(employee),
    officeId: employee.officeId,
    officeName: employee.offices?.name ?? null,
  }));

  const officeOptions = offices.map((office) => ({
    id: office.id,
    name: office.name,
  }));

  return (
    <div className="flex-1 p-4 pb-8">
      <AttendanceClient
        departmentId={params.departmentId}
        initialEmployees={employeeOptions}
        initialOffices={officeOptions}
      />
    </div>
  );
};

export default AttendancePage;
