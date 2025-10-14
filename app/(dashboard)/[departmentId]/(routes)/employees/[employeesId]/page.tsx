import prismadb from "@/lib/prismadb";
import { toScheduleExceptionDto, toWorkScheduleDto } from "@/lib/schedules";

import { EmployeesForm } from "./components/employees-form";

type PageParams = {
  employeesId: string;
  officeId: string;
  eligibilityId: string;
  employeeTypeId: string;
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

  const offices = await prismadb.offices.findMany({
    where: {
      id: params.officeId,
    },
  });

  const employeeType = await prismadb.employeeType.findMany({
    where: {
      id: params.employeeTypeId,
    },
  });

  const eligibility = await prismadb.eligibility.findMany({
    where: {
      id: params.eligibilityId,
    },
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
        />
      </div>
    </div>
  );
};

export default EmployeesIdPage;