// utils/normalizeEmployee.ts
import { EmployeesColumn } from "@/lib/types";
import { format } from "date-fns";


export function normalizeEmployee(emp: any): EmployeesColumn {
  return {
    id: emp.id,
    department: emp.departmentId, // ✅ required in EmployeesColumn
    employeeNo: emp.employeeNo ?? "",
    offices: emp.offices,
    prefix: emp.prefix ?? "",
    firstName: emp.firstName ?? "",
    middleName: emp.middleName ?? "",
    lastName: emp.lastName ?? "",
    suffix: emp.suffix ?? "",
    gender: emp.gender ?? "",
    contactNumber: emp.contactNumber ?? "",
    position: emp.position ?? "",
    birthday: emp.birthday ? format(new Date(emp.birthday), "M d, yyyy") : "",
    education: emp.education ?? "",
    gsisNo: emp.gsisNo ?? "",
    tinNo: emp.tinNo ?? "",
    philHealthNo: emp.philHealthNo ?? "",
    pagIbigNo: emp.pagIbigNo ?? "",
    salary: typeof emp.salary === "number" ? String(emp.salary) : emp.salary ?? "",
    dateHired: emp.dateHired ? format(new Date(emp.dateHired), "M d, yyyy") : "",
    latestAppointment: emp.latestAppointment ?? "",
    terminateDate: emp.terminateDate ?? "",
    isFeatured: !!emp.isFeatured,
    isHead: !!emp.isHead,
    isArchived: !!emp.isArchived,
    eligibility: emp.eligibility,
    employeeType: emp.employeeType,
    images: emp.images ?? [],
    region: emp.region ?? "",
    province: emp.province ?? "",
    city: emp.city ?? "",
    barangay: emp.barangay ?? "",
    houseNo: emp.houseNo ?? "",
    salaryGrade: emp.salaryGrade?.toString() ?? "",
    salaryStep: emp.salaryStep?.toString() ?? "",
    memberPolicyNo: emp.memberPolicyNo ?? "",
    age: emp.age ?? "",
    nickname: emp.nickname ?? "",
    emergencyContactName: emp.emergencyContactName ?? "",
    emergencyContactNumber: emp.emergencyContactNumber ?? "",
    employeeLink: emp.employeeLink ?? "",
    createdAt: emp.createdAt,
    updatedAt: emp.updatedAt,
  };
}
