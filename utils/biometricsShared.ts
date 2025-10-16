export const UNMATCHED_LABEL = "(Unmatched)";
export const UNKNOWN_OFFICE_LABEL = "(Unknown)";
export const UNASSIGNED_OFFICE_LABEL = "(Unassigned)";
export const UNKNOWN_OFFICE_KEY_PREFIX = "__unknown__::";

export const OFFICE_FILTER_STORAGE_KEY = "hrps-bio-office-filter";
export const EXPORT_COLUMNS_STORAGE_KEY = "hrps-bio-export-columns";

export const formatScheduleSource = (value?: string | null): string | null => {
  switch (value) {
    case "WORKSCHEDULE":
      return "Work schedule";
    case "EXCEPTION":
      return "Exception";
    case "DEFAULT":
      return "Default";
    case "NOMAPPING":
      return "No mapping";
    case "":
    case undefined:
    case null:
      return null;
    default:
      return value.charAt(0) + value.slice(1).toLowerCase();
  }
};
