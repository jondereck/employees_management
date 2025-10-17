export const UNMATCHED_LABEL = "(Unmatched)";
export const UNKNOWN_OFFICE_LABEL = "(Unknown)";
export const UNASSIGNED_OFFICE_LABEL = "(Unassigned)";
export const UNKNOWN_OFFICE_KEY_PREFIX = "__unknown__::";

export type MatchStatus = "matched" | "unmatched" | "solved";

export const MATCH_STATUS_PRIORITY: Record<MatchStatus, number> = {
  unmatched: 0,
  matched: 1,
  solved: 2,
};

export const normalizeMatchStatus = (value: unknown): MatchStatus | null => {
  if (typeof value !== "string") return null;
  switch (value.trim().toLowerCase()) {
    case "matched":
      return "matched";
    case "solved":
      return "solved";
    case "unmatched":
      return "unmatched";
    default:
      return null;
  }
};

export const resolveMatchStatus = (
  matchStatus: MatchStatus | null | undefined,
  identityStatus?: "matched" | "unmatched" | "ambiguous" | null,
  resolvedEmployeeId?: string | null
): MatchStatus => {
  if (matchStatus === "matched" || matchStatus === "solved" || matchStatus === "unmatched") {
    return matchStatus;
  }
  if (resolvedEmployeeId && identityStatus !== "matched") return "solved";
  if (identityStatus === "matched") return "matched";
  return "unmatched";
};

export const isSolvedMatchStatus = (
  matchStatus: MatchStatus | null | undefined,
  identityStatus?: "matched" | "unmatched" | "ambiguous" | null,
  resolvedEmployeeId?: string | null
): boolean => resolveMatchStatus(matchStatus, identityStatus, resolvedEmployeeId) === "solved";

export const isUnmatchedMatchStatus = (
  matchStatus: MatchStatus | null | undefined,
  identityStatus?: "matched" | "unmatched" | "ambiguous" | null,
  resolvedEmployeeId?: string | null
): boolean => resolveMatchStatus(matchStatus, identityStatus, resolvedEmployeeId) === "unmatched";

const DIGIT_ONLY = /^\d+$/;

const parsePadLength = (value: string | undefined | null): number => {
  if (!value) return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  if (parsed <= 0) return 0;
  return Math.floor(parsed);
};

export const resolveBiometricTokenPadLength = (): number => {
  if (typeof window === "undefined") {
    const fromServerEnv = parsePadLength(process.env.BIOMETRICS_TOKEN_PAD_LENGTH);
    if (fromServerEnv > 0) return fromServerEnv;
    return parsePadLength(process.env.NEXT_PUBLIC_BIOMETRICS_TOKEN_PAD_LENGTH);
  }
  return parsePadLength(process.env.NEXT_PUBLIC_BIOMETRICS_TOKEN_PAD_LENGTH);
};

export const normalizeBiometricToken = (token: string, padLength?: number): string => {
  if (typeof token !== "string") return "";
  const trimmed = token.trim();
  if (!trimmed) return "";

  let normalized = trimmed.toUpperCase();
  const length = typeof padLength === "number" ? Math.max(0, Math.floor(padLength)) : resolveBiometricTokenPadLength();
  if (length > 0 && DIGIT_ONLY.test(normalized)) {
    normalized = normalized.padStart(length, "0");
  }

  return normalized;
};

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
