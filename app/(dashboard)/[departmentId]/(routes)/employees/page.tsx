import prismadb from "@/lib/prismadb";
import { format  } from "date-fns";
import { EmployeesClient } from "./components/client";
import { EmployeesColumn, Image } from "./components/columns";
import { formatTinNumber, formatter } from "@/lib/utils";
import ApiList from "@/components/ui/api-list";
import { Suspense } from "react";
import EmployeesLoadingSkeleton from "@/components/skeleteon/employees-loading-skeleton";
import CameraScannerWrapper from "@/components/camera-scanner-wrapper";


const EmployeesPage = async ({
  params
}: { 
  params: { departmentId: string}
}) => {

  const offices = await prismadb.offices.findMany({
    orderBy: {
      name: 'asc',
    }
  });

  
  const eligibilities = await prismadb.eligibility
  .findMany({
    orderBy: {
      name: 'asc',
    }
  });

  
  const employeeTypes = await prismadb.employeeType.findMany({
    orderBy: {
      name: 'asc',
    }
  });
  
  const employees = await prismadb.employee.findMany({
    where: {
      departmentId: params.departmentId
    },
    include: {
      offices: true,
      employeeType: true,
      eligibility: true,
      images: true,  
    },
    orderBy: {
      updatedAt: 'desc'
    }
  });

const formattedEmployees: EmployeesColumn[] = employees.map((item) => ({
  id: item.id,
  employeeNo: item.employeeNo,
  department: item.departmentId,
  prefix: item.prefix,
  lastName: item.lastName,
  firstName: item.firstName,
  middleName: item.middleName,
  suffix: item.suffix,
  gender: item.gender,
  contactNumber: item.contactNumber,
  position: item.position,
  birthday: item.birthday ? format(new Date(item.birthday), "M d, yyyy") : '',
  education: item.education,
  gsisNo: item.gsisNo,
  tinNo: item.tinNo,
  philHealthNo: item.philHealthNo,
  pagIbigNo: item.pagIbigNo,
  memberPolicyNo: item.memberPolicyNo,
salaryGrade: item.salaryGrade?.toString() ?? "",
  salaryStep: item.salaryStep?.toString() ?? "", // <-- add this
  salary: typeof item.salary === "number" ? item.salary.toString() : item.salary,
  dateHired: item.dateHired ? format(new Date(item.dateHired), "M d, yyyy") : '',
  latestAppointment: item.latestAppointment,
  terminateDate: item.terminateDate,
  isFeatured: item.isFeatured,
  isArchived: item.isArchived,
  isHead: item.isHead,
  createdAt: format(item.createdAt, "MMMM do, yyyy"),

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
  images: item.images.map((image) => ({
    id: image.id,
    url: image.url,
    value: '',
  })),
  region: item.region,
  province: item.province,
  city: item.city,
  barangay: item.barangay,
  houseNo: item.houseNo,
  age: item.age,
  nickname: item.nickname,
  emergencyContactName: item.emergencyContactName,
  emergencyContactNumber: item.emergencyContactNumber,
  employeeLink: item.employeeLink,
}));

  return ( 
    <div className="flex-col">
    <div className="flex-1 space-y-4 p-4 pt-6">
      <Suspense fallback={<EmployeesLoadingSkeleton />}>
        <EmployeesClient  data={formattedEmployees} departmentId={params.departmentId}offices={offices} eligibilities={eligibilities} employeeTypes={employeeTypes} /> 
        <CameraScannerWrapper/>
      </Suspense>
    </div>
  </div>
  
);
}
 
export default EmployeesPage;