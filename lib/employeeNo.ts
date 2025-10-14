export function firstEmployeeNoToken(employeeNo: string | null | undefined): string | null {
  if (!employeeNo) return null;
  const token = employeeNo.split(",")[0]?.trim();
  return token && token.length > 0 ? token : null;
}
