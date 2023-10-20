import prismadb from "@/lib/prismadb";
import {  EmployeeTypeForm } from "./components/employee-type-form";

const EmployeeTypePage = async ({
  params
}: {
  params: { employeeTypeId: string }
}) => {
  const employeeType = await prismadb.employeeType.findUnique ({
    where: {
      id: params.employeeTypeId
    }
  });


  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
      <EmployeeTypeForm initialData={employeeType}/>
      </div>
    </div>
  );
}

export default EmployeeTypePage;