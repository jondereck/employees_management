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
  dates: string[]; // ISO yyyy-MM-dd
  scope: ManualExclusionScope;
  officeIds?: string[];
  employeeIds?: string[];
  reason: ManualExclusionReason;
  note?: string;
};

export type DTRSlot = {
  amIn?: string;
  amOut?: string;
  pmIn?: string;
  pmOut?: string;
  remark?: string;
  excused?: string;
};

export type DTRDayMap = Record<string, DTRSlot>;

export type DTRPreviewRow = {
  employeeId: string;
  employeeNo: string;
  name: string;
  officeName?: string;
  days: DTRDayMap;
};

export type DTRPreview = {
  month: number;
  year: number;
  rows: DTRPreviewRow[];
};
