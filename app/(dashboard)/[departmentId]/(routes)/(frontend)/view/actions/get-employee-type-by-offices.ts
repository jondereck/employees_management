import prismadb from "@/lib/prismadb";


export const getEmployeeTypeCountsByOffice = async (officeId: string) => {
  const employeeTypeCounts = await prismadb.employee.groupBy({
    by: ['employeeTypeId'],
    _count: {
      _all: true,
    },
    where: {
       officeId: officeId
    },
  });

  return employeeTypeCounts.map((count) => ({
    id: count.employeeTypeId || '',
    count: count._count || 0,
  }));
}