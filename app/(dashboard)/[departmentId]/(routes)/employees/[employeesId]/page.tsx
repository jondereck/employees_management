import prismadb from "@/lib/prismadb";
import { toScheduleExceptionDto, toWorkScheduleDto } from "@/lib/schedules";
import { toWeeklyExclusionDto } from "@/lib/weeklyExclusions";

import { EmployeesForm } from "./components/employees-form";

type PageParams = {
  departmentId: string;
  employeesId: string;
};

const EmployeesIdPage = async ({
  params,
}: {
  params: PageParams;
}) => {
  const employees = await prismadb.employee.findUnique({
    where: {
      id: params.employeesId,
    },
    include: {
      images: true,
      plantillaPosition: {
        select: { id: true, title: true, itemNumber: true },
      },
      officeDivision: {
        select: { id: true, name: true },
      },
    },
  });

  const workSchedules =
    params.employeesId !== "new"
      ? await prismadb.workSchedule.findMany({
          where: { employeeId: params.employeesId },
          orderBy: { effectiveFrom: "desc" },
        })
      : [];

  const scheduleExceptions =
    params.employeesId !== "new"
      ? await prismadb.scheduleException.findMany({
          where: { employeeId: params.employeesId },
          orderBy: { date: "desc" },
        })
      : [];

  const weeklyExclusions =
    params.employeesId !== "new"
      ? await prismadb.weeklyExclusion.findMany({
          where: { employeeId: params.employeesId },
          orderBy: [{ effectiveFrom: "desc" }, { weekday: "asc" }],
        })
      : [];

  const offices = await prismadb.offices.findMany({
    where: {
      departmentId: params.departmentId,
    },
    orderBy: { name: "asc" },
  });

  const employeeType = await prismadb.employeeType.findMany({
    where: {
      departmentId: params.departmentId,
    },
    orderBy: { name: "asc" },
  });

  const eligibility = await prismadb.eligibility.findMany({
    where: {
      departmentId: params.departmentId,
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <EmployeesForm
          employeeType={employeeType}
          eligibility={eligibility}
          offices={offices}
          initialData={employees}
          workSchedules={workSchedules.map(toWorkScheduleDto)}
          scheduleExceptions={scheduleExceptions.map(toScheduleExceptionDto)}
          weeklyExclusions={weeklyExclusions.map(toWeeklyExclusionDto)}
        />
      </div>
    </div>
  );
};

export default EmployeesIdPage;
