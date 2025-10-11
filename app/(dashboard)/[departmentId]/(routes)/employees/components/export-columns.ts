import { EmployeeWithRelations } from "@/lib/types";
import { ExportColumnDefinition } from "@/hooks/use-export-employees";

const toDateOrNull = (value: string | Date | null | undefined) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toNumberOrNull = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const yesNo = (value: boolean) => (value ? "Yes" : "No");

export const employeeExportColumns: ExportColumnDefinition[] = [
  {
    key: "employeeNo",
    label: "Employee No",
    group: "Basic Info",
    getValue: (employee: EmployeeWithRelations) => employee.employeeNo ?? "",
  },
  {
    key: "lastName",
    label: "Last Name",
    group: "Basic Info",
    getValue: (employee) => employee.lastName ?? "",
  },
  {
    key: "firstName",
    label: "First Name",
    group: "Basic Info",
    getValue: (employee) => employee.firstName ?? "",
  },
  {
    key: "middleName",
    label: "Middle Name",
    group: "Basic Info",
    getValue: (employee) => employee.middleName ?? "",
  },
  {
    key: "suffix",
    label: "Suffix",
    group: "Basic Info",
    getValue: (employee) => employee.suffix ?? "",
  },
  {
    key: "nickname",
    label: "Nickname",
    group: "Basic Info",
    getValue: (employee) => employee.nickname ?? "",
  },
  {
    key: "gender",
    label: "Gender",
    group: "Basic Info",
    getValue: (employee) => employee.gender ?? "",
  },
  {
    key: "birthday",
    label: "Birthday",
    group: "Basic Info",
    type: "date",
    getValue: (employee) => toDateOrNull(employee.birthday ?? null),
  },
  {
    key: "age",
    label: "Age",
    group: "Basic Info",
    getValue: (employee) => employee.age ?? "",
  },
  {
    key: "contactNumber",
    label: "Contact Number",
    group: "Basic Info",
    getValue: (employee) => employee.contactNumber ?? "",
  },
  {
    key: "office",
    label: "Office",
    group: "Job Details",
    getValue: (employee) => employee.offices?.name ?? "",
  },
  {
    key: "position",
    label: "Position",
    group: "Job Details",
    getValue: (employee) => employee.position ?? "",
  },
  {
    key: "employeeType",
    label: "Employee Type",
    group: "Job Details",
    getValue: (employee) => employee.employeeType?.name ?? "",
  },
  {
    key: "eligibility",
    label: "Eligibility",
    group: "Job Details",
    getValue: (employee) => employee.eligibility?.name ?? "",
  },
  {
    key: "dateHired",
    label: "Date Hired",
    group: "Job Details",
    type: "date",
    getValue: (employee) => toDateOrNull(employee.dateHired ?? null),
  },
  {
    key: "latestAppointment",
    label: "Latest Appointment",
    group: "Job Details",
    getValue: (employee) => employee.latestAppointment ?? "",
  },
  {
    key: "terminateDate",
    label: "Terminate Date",
    group: "Job Details",
    type: "date",
    getValue: (employee) => toDateOrNull(employee.terminateDate ?? null),
  },
  {
    key: "salaryGrade",
    label: "Salary Grade",
    group: "Job Details",
    getValue: (employee) => employee.salaryGrade ?? "",
  },
  {
    key: "salaryStep",
    label: "Salary Step",
    group: "Job Details",
    getValue: (employee) => employee.salaryStep ?? "",
  },
  {
    key: "salary",
    label: "Salary",
    group: "Job Details",
    type: "number",
    getValue: (employee) => toNumberOrNull(employee.salary),
  },
  {
    key: "memberPolicyNo",
    label: "Member Policy No",
    group: "Job Details",
    getValue: (employee) => employee.memberPolicyNo ?? "",
  },
  {
    key: "isHead",
    label: "Is Head",
    group: "Job Details",
    getValue: (employee) => yesNo(Boolean(employee.isHead)),
  },
  {
    key: "status",
    label: "Status",
    group: "Job Details",
    getValue: (employee) => (employee.isArchived ? "Inactive" : "Active"),
  },
  {
    key: "houseNo",
    label: "House No",
    group: "Address",
    getValue: (employee) => employee.houseNo ?? "",
  },
  {
    key: "street",
    label: "Street",
    group: "Address",
    getValue: (employee) => employee.street ?? "",
  },
  {
    key: "barangay",
    label: "Barangay",
    group: "Address",
    getValue: (employee) => employee.barangay ?? "",
  },
  {
    key: "city",
    label: "City",
    group: "Address",
    getValue: (employee) => employee.city ?? "",
  },
  {
    key: "province",
    label: "Province",
    group: "Address",
    getValue: (employee) => employee.province ?? "",
  },
  {
    key: "region",
    label: "Region",
    group: "Address",
    getValue: (employee) => employee.region ?? "",
  },
  {
    key: "gsisNo",
    label: "GSIS No",
    group: "Government IDs",
    getValue: (employee) => employee.gsisNo ?? "",
  },
  {
    key: "tinNo",
    label: "TIN No",
    group: "Government IDs",
    getValue: (employee) => employee.tinNo ?? "",
  },
  {
    key: "philHealthNo",
    label: "PhilHealth No",
    group: "Government IDs",
    getValue: (employee) => employee.philHealthNo ?? "",
  },
  {
    key: "pagIbigNo",
    label: "Pag-IBIG No",
    group: "Government IDs",
    getValue: (employee) => employee.pagIbigNo ?? "",
  },
  {
    key: "emergencyContactName",
    label: "Emergency Contact Name",
    group: "Government IDs",
    getValue: (employee) => employee.emergencyContactName ?? "",
  },
  {
    key: "emergencyContactNumber",
    label: "Emergency Contact Number",
    group: "Government IDs",
    getValue: (employee) => employee.emergencyContactNumber ?? "",
  },
];
