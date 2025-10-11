import { describe, expect, it } from "vitest";

import {
  partitionEmployeesByOffice,
  sanitizeSheetName,
  ExportOfficeOption,
} from "@/utils/download-excel";
import { EmployeeWithRelations } from "@/lib/types";

const createEmployee = (overrides: Partial<EmployeeWithRelations>): EmployeeWithRelations => ({
  id: overrides.id ?? "emp",
  employeeNo: overrides.employeeNo ?? null,
  departmentId: overrides.departmentId ?? "dept",
  prefix: overrides.prefix ?? "",
  lastName: overrides.lastName ?? "Doe",
  firstName: overrides.firstName ?? "John",
  middleName: overrides.middleName ?? null,
  suffix: overrides.suffix ?? "",
  gender: overrides.gender ?? null,
  contactNumber: overrides.contactNumber ?? null,
  position: overrides.position ?? null,
  birthday: overrides.birthday ?? null,
  education: overrides.education ?? null,
  gsisNo: overrides.gsisNo ?? null,
  tinNo: overrides.tinNo ?? null,
  philHealthNo: overrides.philHealthNo ?? null,
  pagIbigNo: overrides.pagIbigNo ?? null,
  memberPolicyNo: overrides.memberPolicyNo ?? null,
  salaryGrade: overrides.salaryGrade ?? null,
  salaryStep: overrides.salaryStep ?? null,
  salary: overrides.salary ?? null,
  dateHired: overrides.dateHired ?? null,
  latestAppointment: overrides.latestAppointment ?? null,
  terminateDate: overrides.terminateDate ?? null,
  isFeatured: overrides.isFeatured ?? false,
  isArchived: overrides.isArchived ?? false,
  isHead: overrides.isHead ?? false,
  createdAt: overrides.createdAt ?? new Date().toISOString(),
  updatedAt: overrides.updatedAt ?? new Date().toISOString(),
  region: overrides.region ?? null,
  province: overrides.province ?? null,
  city: overrides.city ?? null,
  barangay: overrides.barangay ?? null,
  houseNo: overrides.houseNo ?? null,
  street: overrides.street ?? null,
  age: overrides.age ?? null,
  nickname: overrides.nickname ?? null,
  emergencyContactName: overrides.emergencyContactName ?? null,
  emergencyContactNumber: overrides.emergencyContactNumber ?? null,
  employeeLink: overrides.employeeLink ?? null,
  offices: overrides.offices ?? { id: "office", name: "Office", bioIndexCode: null },
  employeeType:
    overrides.employeeType ?? ({ id: "type", name: "Regular", value: "regular" } as EmployeeWithRelations["employeeType"]),
  eligibility:
    overrides.eligibility ?? ({ id: "elig", name: "Eligibility", value: "elig" } as EmployeeWithRelations["eligibility"]),
  images: overrides.images ?? [],
  designation: overrides.designation ?? null,
  note: overrides.note ?? null,
});

describe("sanitizeSheetName", () => {
  it("removes invalid characters and trims length", () => {
    expect(sanitizeSheetName("Finance/HR*Office??")).toBe("Finance HR Office");
    expect(sanitizeSheetName("   [Secret]:Name  ")).toBe("Secret Name");
    expect(sanitizeSheetName("".padEnd(5, " "))).toBe("Sheet");
  });

  it("limits sheet names to 31 characters", () => {
    const longName = "Operations".repeat(5);
    const sanitized = sanitizeSheetName(longName);
    expect(sanitized.length).toBeLessThanOrEqual(31);
  });
});

describe("partitionEmployeesByOffice", () => {
  const offices: ExportOfficeOption[] = [
    { id: "o1", name: "Human Resources", bioIndexCode: "HR" },
    { id: "o2", name: "Finance Office", bioIndexCode: "FIN" },
    { id: "o3", name: "IT Services", bioIndexCode: "IT" },
  ];

  const employees: EmployeeWithRelations[] = [
    createEmployee({
      id: "e1",
      firstName: "Anna",
      lastName: "Smith",
      offices: { id: "o1", name: "Human Resources", bioIndexCode: "HR" },
    }),
    createEmployee({
      id: "e2",
      firstName: "Leo",
      lastName: "Baker",
      offices: { id: "o2", name: "Finance Office", bioIndexCode: "FIN" },
    }),
    createEmployee({
      id: "e3",
      firstName: "Nia",
      lastName: "Clark",
      offices: { id: "o2", name: "Finance Office", bioIndexCode: "FIN" },
    }),
  ];

  it("creates a group for each selected office including empty ones", () => {
    const groups = partitionEmployeesByOffice(employees, offices, "all");
    expect(groups).toHaveLength(3);

    const hrGroup = groups.find((group) => group.officeId === "o1");
    expect(hrGroup?.employees).toHaveLength(1);

    const financeGroup = groups.find((group) => group.officeId === "o2");
    expect(financeGroup?.employees.map((emp) => emp.id)).toEqual(["e2", "e3"]);

    const itGroup = groups.find((group) => group.officeId === "o3");
    expect(itGroup?.employees).toHaveLength(0);
    expect(itGroup?.officeShortCode).toBe("IT");
  });

  it("filters to specific offices and sorts employees by last name", () => {
    const groups = partitionEmployeesByOffice(employees, offices, ["o2"]);
    expect(groups).toHaveLength(1);
    const [finance] = groups;
    expect(finance.officeId).toBe("o2");
    expect(finance.employees.map((emp) => emp.lastName)).toEqual(["Baker", "Clark"]);
  });
});
