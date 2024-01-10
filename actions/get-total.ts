import prismadb from "@/lib/prismadb"

export const getTotal = async (employeeTypeId: string) => {
   const totalPermanentEmployees  = await prismadb.employee.count({
    where: {
      employeeTypeId: employeeTypeId,
      isArchived: false
    },
   });

   return totalPermanentEmployees
}