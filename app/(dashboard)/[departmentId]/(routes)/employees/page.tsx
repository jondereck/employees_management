import prismadb from "@/lib/prismadb";
import { format  } from "date-fns";
import { EmployeesClient } from "./components/client";
import { EmployeesColumn } from "./components/columns";
import { formatTinNumber, formatter } from "@/lib/utils";


const EmployeesPage = async ({
  params
}: { 
  params: { departmentId: string}
}) => {
  const employees = await prismadb.employee.findMany({
    where: {
      departmentId: params.departmentId
    },
    include: {
      offices: true,
      employeeType: true,
      eligibility: true,
    },
    orderBy: {
      createdAt: 'desc'
    }
  });


  const formattedEmployees: EmployeesColumn[] = employees.map((item)=> ({
    id: item.id,
    lastName: item.lastName,
    firstName: item.firstName,
    middleName: item.middleName,
    suffix: item.suffix,
    gender: item.gender,
    age: item.age,
    contactNumber: item.contactNumber,
    position: item.position,
    birthday: format(item.birthday, "MMMM do, yyyy"),
    gsisNo: item.gsisNo,
    tinNo: item.tinNo,
    philHealthNo: item.philHealthNo,
    pagibigNo: item.pagIbigNo,
    salary: formatter.format(item.salary),
    dateHired: format(item.dateHired, "MMMM do, yyyy"),
    employeeType: item.employeeType.name,
    offices: item.offices.name,
    eligibility: item.eligibility.customType,
    isFeatured: item.isFeatured,
    isArchived: item.isArchived,
    createdAt: format(item.createdAt, "MMMM do, yyyy"),
  }));

  return ( 
  <div className="flex-col">
    <div className="flex-1 space-y-4 p-8  pt-6">
    <EmployeesClient data={formattedEmployees}/>
    </div>
  </div> );
}
 
export default EmployeesPage;