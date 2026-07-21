export function getEmployeeOfficeDisplay({
  officeName,
  divisionName,
}: {
  officeName?: string | null;
  divisionName?: string | null;
}) {
  return {
    officeName: officeName?.trim() || "N/A",
    divisionName: divisionName?.trim() || null,
  };
}
