export const formatEmployeeName = (employee: {
  prefix: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
}) => {
  const parts = [
    employee.prefix?.trim(),
    employee.firstName?.trim(),
    employee.middleName ? `${employee.middleName.charAt(0).toUpperCase()}.` : undefined,
    employee.lastName?.trim(),
    employee.suffix?.trim(),
  ];
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
};
