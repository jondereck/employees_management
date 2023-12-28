import prismadb from "@/lib/prismadb";


export const getEmployeeCountsByOffice = async (officeId: string) => {
  const employeeCounts = await prismadb.employee.groupBy({
    by: ['officeId'],
    _count: {
      _all: true,
    },
    where: {
      officeId: officeId,
      isArchived: false,
    },
  });

  return employeeCounts.map((count) => ({
    id: count.officeId || '',
    count: count._count || 0,
  }));
}
