export type ManualExclusionScope = "all" | "offices" | "employees";

export type ManualExclusionReason =
  | "SUSPENSION"
  | "OFFICE_CLOSURE"
  | "CALAMITY"
  | "TRAINING"
  | "LEAVE"
  | "LOCAL_HOLIDAY"
  | "OTHER";

export type ManualExclusion = {
  id: string;
  dates: string[];
  holidayNamesByDate?: Record<string, string>;
  scope: ManualExclusionScope;
  officeIds?: string[];
  employeeIds?: string[];
  reason: ManualExclusionReason;
  note?: string;
  otEligible?: boolean;
};
