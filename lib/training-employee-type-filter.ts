/**
 * Resolve which employeeTypeIds remain included after an exclude list.
 * Prefer positive `in` filters over `notIn` so only known, selected types are counted.
 */
export function resolveIncludedEmployeeTypeIds(
  allTypeIds: string[],
  excludeEmployeeTypeIds: string[]
): string[] | null {
  if (excludeEmployeeTypeIds.length === 0) return null; // no type filter
  const exclude = new Set(excludeEmployeeTypeIds);
  return allTypeIds.filter((id) => !exclude.has(id));
}
