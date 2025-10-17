import { randomUUID } from "crypto";

import type { PerDayRow, PerEmployeeRow } from "@/utils/parseBioAttendance";
import { normalizeBiometricToken } from "@/utils/normalizeBiometricToken";

export type AttendanceEvaluationRow = {
  employeeId: string;
  employeeName: string;
  resolvedEmployeeId?: string | null;
  officeId?: string | null;
  officeName?: string | null;
  employeeToken: string;
  dateISO: string;
  day: number;
  earliest?: string | null;
  latest?: string | null;
  allTimes: string[];
  punches: Array<{
    time: string;
    minuteOfDay: number;
    source: "original" | "merged";
    files: string[];
  }>;
  sourceFiles: string[];
};

type SessionEntry = AttendanceEvaluationRow & {
  normalizedToken: string;
};

type SessionData = {
  id: string;
  createdAt: number;
  entries: SessionEntry[];
  perDay: PerDayRow[];
  perEmployee: PerEmployeeRow[];
  entryIndexesByToken: Map<string, number[]>;
  perDayIndexesByToken: Map<string, number[]>;
  perEmployeeIndexByToken: Map<string, number>;
  tokenToEmployeeId: Map<string, string | null>;
};

const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

const sessions = new Map<string, SessionData>();

const cleanupExpiredSessions = () => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
};

const buildIndexMap = (tokens: string[]): Map<string, number[]> => {
  const map = new Map<string, number[]>();
  tokens.forEach((token, index) => {
    if (!token) return;
    const list = map.get(token) ?? [];
    list.push(index);
    map.set(token, list);
  });
  return map;
};

export const createBiometricsSession = (params: {
  entries: AttendanceEvaluationRow[];
  perDay: PerDayRow[];
  perEmployee: PerEmployeeRow[];
  tokenToEmployeeId: Map<string, string | null>;
}): string => {
  cleanupExpiredSessions();

  const { entries, perDay, perEmployee, tokenToEmployeeId } = params;

  const enrichedEntries: SessionEntry[] = entries.map((entry) => ({
    ...entry,
    normalizedToken: normalizeBiometricToken(entry.employeeToken || entry.employeeId),
  }));

  const perDayTokens = perDay.map((row) =>
    normalizeBiometricToken(row.employeeToken || row.employeeId || row.employeeName)
  );
  const perEmployeeTokens = perEmployee.map((row) =>
    normalizeBiometricToken(row.employeeToken || row.employeeId || row.employeeName)
  );

  const entryIndexesByToken = buildIndexMap(enrichedEntries.map((entry) => entry.normalizedToken));
  const perDayIndexesByToken = buildIndexMap(perDayTokens);
  const perEmployeeIndexByToken = new Map<string, number>();
  perEmployeeTokens.forEach((token, index) => {
    if (!token || perEmployeeIndexByToken.has(token)) return;
    perEmployeeIndexByToken.set(token, index);
  });

  const id = randomUUID();

  sessions.set(id, {
    id,
    createdAt: Date.now(),
    entries: enrichedEntries,
    perDay: [...perDay],
    perEmployee: [...perEmployee],
    entryIndexesByToken,
    perDayIndexesByToken,
    perEmployeeIndexByToken,
    tokenToEmployeeId: new Map(tokenToEmployeeId),
  });

  return id;
};

export const getBiometricsSession = (sessionId: string): SessionData | null => {
  cleanupExpiredSessions();
  return sessions.get(sessionId) ?? null;
};

export const touchBiometricsSession = (sessionId: string) => {
  const session = sessions.get(sessionId);
  if (session) {
    session.createdAt = Date.now();
  }
};

export const updateSessionTokenData = (
  sessionId: string,
  token: string,
  update: {
    entries?: AttendanceEvaluationRow[];
    perDay?: PerDayRow[];
    perEmployee?: PerEmployeeRow | null;
    resolvedEmployeeId?: string | null;
  }
) => {
  const session = sessions.get(sessionId);
  if (!session) return;

  const normalizedToken = normalizeBiometricToken(token);

  if (update.entries) {
    const entryIndexes = session.entryIndexesByToken.get(normalizedToken) ?? [];
    entryIndexes.forEach((index, idx) => {
      const next = update.entries?.[idx];
      if (!next) return;
      session.entries[index] = {
        ...next,
        normalizedToken,
      };
    });
  }

  if (update.perDay) {
    const dayIndexes = session.perDayIndexesByToken.get(normalizedToken) ?? [];
    dayIndexes.forEach((index, idx) => {
      const next = update.perDay?.[idx];
      if (!next) return;
      session.perDay[index] = next;
    });
  }

  if (update.perEmployee !== undefined) {
    const employeeIndex = session.perEmployeeIndexByToken.get(normalizedToken);
    if (employeeIndex != null) {
      if (update.perEmployee) {
        session.perEmployee[employeeIndex] = update.perEmployee;
      } else {
        session.perEmployee.splice(employeeIndex, 1);
        session.perEmployeeIndexByToken.delete(normalizedToken);
      }
    } else if (update.perEmployee) {
      session.perEmployee.push(update.perEmployee);
      session.perEmployeeIndexByToken.set(normalizedToken, session.perEmployee.length - 1);
    }
  }

  if (update.resolvedEmployeeId !== undefined) {
    session.tokenToEmployeeId.set(normalizedToken, update.resolvedEmployeeId);
  }
};

