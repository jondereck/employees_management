import prismadb from "@/lib/prismadb";
import { format  } from "date-fns";
import { EmployeeTypeClient } from "./components/client";
import { EmployeeTypeColumn } from "./components/columns";

const EmployeeTypePage = async ({
  params
}: { 
  params: { departmentId: string}
}) => {
  const employeeType = await prismadb.employeeType.findMany({
    where: {
      departmentId: params.departmentId
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  const formattedEmployeeType: EmployeeTypeColumn[] = employeeType.map((item)=> ({
    id: item.id,
    name: item.name,
    value: item.value,
    createdAt: format(item.createdAt, "MMMM do, yyyy"),
  }));

  return ( 
  <div className="flex-col">
    <div className="flex-1 space-y-4 p-8  pt-6">
    <EmployeeTypeClient data={formattedEmployeeType}/>
    </div>
  </div> );
}
 
export default EmployeeTypePage;