import type { WorkforceDetailsView } from "@/lib/office-workforce";

export function officeWorkforceSummaryKey(departmentId: string) {
  return `/api/${departmentId}/offices/workforce-summary`;
}

export function officeWorkforceDetailsKey(
  departmentId: string,
  officeId: string,
  view: WorkforceDetailsView
) {
  return `/api/${departmentId}/offices/${officeId}/workforce-details?view=${view}`;
}

export function isOfficeWorkforceDetailsKey(
  key: unknown,
  departmentId: string
) {
  if (typeof key !== "string" || !departmentId) return false;

  const escapedDepartmentId = departmentId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `^/api/${escapedDepartmentId}/offices/[^/?#]+/workforce-details\\?view=(?:vacant|assigned-here-plantilla-elsewhere|plantilla-here-assigned-elsewhere)$`
  ).test(key);
}
