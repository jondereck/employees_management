import prismadb from "@/lib/prismadb";



export const getEligibilityCountsByOffice = async (officeId: string) => {
  const eligibilityCounts = await prismadb.employee.groupBy({
    by: ['eligibilityId'],
    _count: {
      _all: true,
    },
    where: {
       officeId: officeId,
       isArchived: false,
    },
  });

  return eligibilityCounts.map((count) => ({
    id: count.eligibilityId || '',
    count: count._count || 0,
  }));
}