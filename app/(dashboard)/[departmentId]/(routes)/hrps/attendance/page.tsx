import prismadb from "@/lib/prismadb";
import { AttendanceClient } from "./components/attendance-client";

const buildEmployeeName = (employee: {
  firstName: string;
  lastName: string;
  middleName: string | null;
  suffix: string | null;
}) => {
  const parts = [employee.lastName, ", ", employee.firstName];
  if (employee.middleName) parts.push(` ${employee.middleName}`);
  if (employee.suffix) parts.push(` ${employee.suffix}`);
  return parts.join("").trim();
};

const AttendancePage = async ({ params }: { params: { departmentId: string } }) => {
  const [offices, employees] = await Promise.all([
    prismadb.offices.findMany({
      where: { departmentId: params.departmentId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prismadb.employee.findMany({
      where: { departmentId: params.departmentId },
      select: {
        id: true,
        officeId: true,
        firstName: true,
        lastName: true,
        middleName: true,
        suffix: true,
      },
      orderBy: { lastName: "asc" },
    }),
  ]);

  const employeesLite = employees.map((employee) => ({
    id: employee.id,
    officeId: employee.officeId,
    name: buildEmployeeName(employee),
  }));

  return (
    <AttendanceClient
      departmentId={params.departmentId}
      initialOffices={offices}
      initialEmployees={employeesLite}
    />
  );
};

export default AttendancePage;
