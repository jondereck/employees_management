export type RawPunch = { date: string; times: string[] };
export type RawRecord = {
  bioUserId: string;
  name?: string;
  officeHint?: string;
  punches: RawPunch[];
};

export type BioSource = { kind: "header" } | { kind: "column"; column: string };

export type Schedule = { start: string; end: string; graceMin: number };

export type DayResult = {
  date: string;
  firstIn?: string;
  lastOut?: string;
  tardyMin: number;
  underMin: number;
  exception?: string;
};

export type EmployeeMatch = {
  employeeId: string;
  officeId: string | null;
  bioUserId: string;
  days: { date: string; times: string[] }[];
};

export type UnmatchedRecord = {
  bioUserId: string;
  name?: string;
  officeHint?: string;
};

export type AttendanceEmployeeInfo = {
  id: string;
  name: string;
  officeId: string | null;
  officeName?: string | null;
};

export type UploadMeta = {
  rows: number;
  distinctBio: number;
  inferred?: boolean;
};

export type UploadSession = {
  id: string;
  departmentId: string;
  raw: RawRecord[];
  month: string;
  meta: UploadMeta;
  createdAt: number;
};

export const UNASSIGNED_OFFICE_KEY = "__unassigned__";

export type UploadResponse = {
  uploadId: string;
  month: string;
  raw: RawRecord[];
  meta: UploadMeta;
  matched: EmployeeMatch[];
  unmatched: UnmatchedRecord[];
  employees: AttendanceEmployeeInfo[];
  offices: { id: string; name: string }[];
};
