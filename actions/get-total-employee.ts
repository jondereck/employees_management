import prismadb from "@/lib/prismadb"

export const getTotalEmployees = async (departmentId: string): Promise<number> => {
   const totalEmployees = await prismadb.employee.count({
    where: {
      departmentId: departmentId,
      isArchived: false
    },
   });

   return totalEmployees
}