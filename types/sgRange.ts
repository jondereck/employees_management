export type HeadsMode = "all" | "headsOnly";

export type SGRangeFilters = {
  officeIds?: string[];
  headsMode?: HeadsMode;
  employmentTypes?: string[];
  dateFrom?: string;
  dateTo?: string;
  includeUnknownSG?: boolean;
};

export type SGRangePayload = {
  L: number;
  R: number;
  filters: SGRangeFilters;
};

export type SGBucket = {
  sg: number;
  count: number;
  sumSalary: number;
};

export type SGRangeResult = {
  range: { L: number; R: number };
  count: number;
  sumSalary: number;
  avgSalary: number;
  perSG: SGBucket[];
  meta: Record<string, unknown>;
};
