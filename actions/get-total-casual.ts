import prismadb from "@/lib/prismadb"

export const getTotalCasual = async (employeeTypeId: string) => {
   const totalCasualEmployees  = await prismadb.employee.count({
    where: {
      employeeTypeId: employeeTypeId,
      isArchived: false
    },
   });

   return totalCasualEmployees
}