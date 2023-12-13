import prismadb from "@/lib/prismadb"

export const getTotalPermanent = async (employeeTypeId: string) => {
   const totalPermanentEmployees  = await prismadb.employee.count({
    where: {
      employeeTypeId: employeeTypeId,
      isArchived: false
    },
   });

   return totalPermanentEmployees
}