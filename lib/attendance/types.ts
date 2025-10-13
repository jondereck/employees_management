export type RawPunch = { date: string; times: string[] };
export type RawRecord = { bioUserId: string; name?: string; officeHint?: string; punches: RawPunch[] };

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
  officeId: string;
  bioUserId: string;
  days: { date: string; times: string[] }[];
};

export type UploadMeta = {
  rows: number;
  distinctBio: number;
  inferred?: boolean;
};

export type UploadSummary = {
  uploadId: string;
  month: string;
  raw: RawRecord[];
  meta: UploadMeta;
};

export type EmployeeLite = {
  id: string;
  name: string;
  officeId: string;
};

export type OfficeLite = {
  id: string;
  name: string;
};

export type UnmatchedBio = {
  bioUserId: string;
  name?: string;
  officeHint?: string;
};
