import prismadb from "@/lib/prismadb"

export const getTotalJobOrder = async (employeeTypeId: string) => {
   const totalJobOrderEmployees  = await prismadb.employee.count({
    where: {
      employeeTypeId: employeeTypeId,
    },
   });

   return totalJobOrderEmployees
}