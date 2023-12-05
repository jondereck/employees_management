import prismadb from "@/lib/prismadb"

export const getTotalEmployees = async (departmentId: string) => {
   const totalEmployees = await prismadb.employee.count({
    where: {
      departmentId: departmentId,
    },
   });

   return totalEmployees
}