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
      updatedAt: 'desc'
    }
  });


  const formattedEmployees: EmployeesColumn[] = employees.map((item)=> ({
    id: item.id,
    prefix: item.prefix,
    lastName: item.lastName,
    firstName: item.firstName,
    middleName: item.middleName,
    suffix: item.suffix,
    gender: item.gender,
    contactNumber: item.contactNumber,
    position: item.position,
    birthday: format(item.birthday, "MMMM do, yyyy"),
    gsisNo: item.gsisNo,
    tinNo: item.tinNo,
    philHealthNo: item.philHealthNo,
    pagIbigNo: item.pagIbigNo,
    memberPolicyNo: item.memberPolicyNo,
    salary: formatter.format(item.salary),
    salaryGrade:item.salaryGrade,
    dateHired: format(item.dateHired, "MMMM do, yyyy"),
    latestAppointment: format(item.dateHired, "MMMM do, yyyy"),
    terminateDate: item.terminateDate,
    // employeeType: item.employeeType.name,
    // offices: item.offices.name,
    // eligibility: item.eligibility.name,
    isFeatured: item.isFeatured,
    isArchived: item.isArchived,
    isHead: item.isHead,
    createdAt: format(item.createdAt, "MMMM do, yyyy"),
    // images: [],
    eligibility: {
      id: item.eligibility.id,
      name: item.eligibility.name,
      value: item.eligibility.value,
    },
    employeeType: {
      id: item.employeeType.id,
      name: item.employeeType.name,
      value: item.employeeType.value,
    },
    offices: {
      id: item.offices.id,
      name: item.offices.name,
    },
    images:[],
    region: item.region,
  province: item.province,
  city: item.city,
  barangay: item.barangay,
  houseNo: item.houseNo,
  age:item.age
  }));

  return ( 
  <div className="flex-col">
    <div className="flex-1 space-y-4 p-8  pt-6">
    <EmployeesClient data={formattedEmployees}/>
    </div>
  </div> );
}
 
export default EmployeesPage;