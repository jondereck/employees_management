type DepartmentReference = { id: string } | null;

export function validateEmployeeDepartmentReferences(input: {
  office: DepartmentReference;
  employeeType: DepartmentReference;
  eligibility: DepartmentReference;
}): string | null {
  if (!input.office) return "Office not found in this department";
  if (!input.employeeType) return "Appointment not found in this department";
  if (!input.eligibility) return "Eligibility not found in this department";
  return null;
}
