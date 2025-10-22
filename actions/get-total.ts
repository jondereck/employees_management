import prismadb from "@/lib/prismadb"

export const getTotal = async (employeeTypeId: string, departmentId: string) => {
  const totalEmployees = await prismadb.employee.count({
    where: {
      employeeTypeId,
      departmentId,
      isArchived: false,
    },
  });

  return totalEmployees;
}
