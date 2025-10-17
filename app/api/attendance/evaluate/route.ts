import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as XLSX from "xlsx";
import { performance } from "perf_hooks";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  getScheduleMapsForMonth,
  normalizeSchedule,
  resolveScheduleForDate,
  type ScheduleSource,
} from "@/lib/schedules";
import { firstEmployeeNoToken } from "@/lib/employeeNo";
import {
  evaluateDay,
  normalizePunchTimes,
  type DayEvaluationStatus,
  type HHMM,
} from "@/utils/evaluateDay";
import {
  mergeParsedWorkbooks,
  parseBioAttendance,
  sortPerDayRows,
  summarizePerEmployee,
  type DayPunch,
  type ParsedPerDayRow,
  type ParsedWorkbook,
  type PerDayRow,
  type PerEmployeeRow,
} from "@/utils/parseBioAttendance";
import {
  UNASSIGNED_OFFICE_LABEL,
  UNMATCHED_LABEL,
  UNKNOWN_OFFICE_LABEL,
} from "@/utils/biometricsShared";
import type { WeeklyPatternWindow } from "@/utils/weeklyPattern";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type IdentityRecord = {
  status: "matched" | "unmatched" | "ambiguous";
  employeeId: string | null;
  employeeName: string;
  officeId: string | null;
  officeName: string | null;
  candidates?: string[];
  missingOffice?: boolean;
};

type EvaluatedDay = {
  employeeId: string;
  employeeName: string;
  resolvedEmployeeId?: string | null;
  officeId?: string | null;
  officeName?: string | null;
  day: number;
  earliest: string | null;
  latest: string | null;
  allTimes: string[];
  dateISO: string;
  internalEmployeeId: string | null;
  status: DayEvaluationStatus;
  isLate: boolean;
  isUndertime: boolean;
  workedHHMM: string;
  workedMinutes: number;
  scheduleType: string;
  scheduleSource: ScheduleSource;
  punches?: DayPunch[];
  sourceFiles?: string[];
  employeeToken: string;
  lateMinutes?: number | null;
  undertimeMinutes?: number | null;
  requiredMinutes?: number | null;
  scheduleStart?: string | null;
  scheduleEnd?: string | null;
  scheduleGraceMinutes?: number | null;
  weeklyPatternApplied?: boolean;
  weeklyPatternWindows?: WeeklyPatternWindow[] | null;
  weeklyPatternPresence: { start: string; end: string }[];
  identityStatus?: "matched" | "unmatched" | "ambiguous";
};

type FileMetric = {
  id: string;
  name: string;
  size: number | null;
  downloadMs: number;
  parseMs: number;
  rows: number;
  punches: number;
};

type EvaluationMetadata = {
  files: FileMetric[];
  totals: {
    files: number;
    rows: number;
    employees: number;
    punches: number;
    downloadMs: number;
    parseMs: number;
    mergeMs: number;
    evaluationMs: number;
    manualPeriodApplied: boolean;
  };
};

const FileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  blobUrl: z.string().url(),
  size: z.number().int().positive().optional(),
  type: z.string().min(1).optional(),
});

const IdentitySchema = z.object({
  token: z.string().min(1),
  record: z
    .object({
      status: z.enum(["matched", "unmatched", "ambiguous"]).optional(),
      employeeId: z.string().min(1).nullable().optional(),
      employeeName: z.string().optional(),
      officeId: z.string().min(1).nullable().optional(),
      officeName: z.string().optional(),
      candidates: z.array(z.string()).optional(),
      missingOffice: z.boolean().optional(),
    })
    .optional(),
});

const ManualSelectionSchema = z
  .object({
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(1900).max(2100),
  })
  .nullable();

const PayloadSchema = z.object({
  month: z.number().int().min(1).max(12).nullable().optional(),
  year: z.number().int().min(1900).max(2100).nullable().optional(),
  files: z.array(FileSchema).min(1).max(10),
  identity: z.array(IdentitySchema).optional(),
  options: z
    .object({
      manualPeriod: z.boolean().optional(),
      useManualPeriod: z.boolean().optional(),
      manualSelection: ManualSelectionSchema.optional(),
    })
    .optional(),
});

const MAX_TOTAL_SIZE_BYTES = 40 * 1024 * 1024; // 40 MB total per evaluation
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB per file
const MAX_SHEETS = 200;
const MAX_ROWS = 200_000;
const MAX_TOTAL_PUNCHES = 1_000_000;

const pad2 = (value: number) => value.toString().padStart(2, "0");

const composeManualDate = (year: number, month: number, day: number): string | null => {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
};

const sortPunchesChronologically = (punches: DayPunch[]): DayPunch[] =>
  [...punches].sort((a, b) => a.minuteOfDay - b.minuteOfDay || a.time.localeCompare(b.time));

const toChronologicalRow = <T extends ParsedPerDayRow>(row: T): T => {
  const punches = sortPunchesChronologically(row.punches);
  const allTimes = punches.map((punch) => punch.time);
  return {
    ...row,
    punches,
    allTimes,
    earliest: allTimes[0] ?? null,
    latest: allTimes.length ? allTimes[allTimes.length - 1] : null,
  } as T;
};

const normalizeIdentityRecord = (record?: IdentityRecord | null): IdentityRecord => {
  if (!record) {
    return {
      status: "unmatched",
      employeeId: null,
      employeeName: UNMATCHED_LABEL,
      officeId: null,
      officeName: UNKNOWN_OFFICE_LABEL,
    };
  }

  const status = record.status ?? "matched";
  const employeeName = record.employeeName?.trim();
  const officeName = record.officeName?.trim();

  if (status === "unmatched") {
    return {
      status: "unmatched",
      employeeId: null,
      employeeName: employeeName && employeeName.length ? employeeName : UNMATCHED_LABEL,
      officeId: null,
      officeName: UNKNOWN_OFFICE_LABEL,
    };
  }

  return {
    status,
    employeeId: record.employeeId ?? null,
    employeeName: employeeName && employeeName.length ? employeeName : UNMATCHED_LABEL,
    officeId: record.officeId ?? null,
    officeName: officeName && officeName.length ? officeName : UNASSIGNED_OFFICE_LABEL,
    candidates:
      status === "ambiguous" && record.candidates && record.candidates.length
        ? [...record.candidates]
        : undefined,
    missingOffice: record.missingOffice,
  };
};

const validateTotalSize = (files: z.infer<typeof FileSchema>[]) => {
  let total = 0;
  for (const file of files) {
    if (file.size && file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File "${file.name}" exceeds the maximum allowed size of 10 MB.`);
    }
    total += file.size ?? 0;
  }
  if (total > MAX_TOTAL_SIZE_BYTES) {
    throw new Error("Combined file size exceeds the 40 MB limit per evaluation.");
  }
};

const ensureHttpsUrl = (value: string) => {
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error("Blob URLs must use HTTPS.");
  }
  return url;
};

export async function POST(request: Request) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: z.infer<typeof PayloadSchema>;
  try {
    const json = await request.json();
    payload = PayloadSchema.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  try {
    validateTotalSize(payload.files);
  } catch (error) {
    const message = error instanceof Error ? error.message : "File validation failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const manualPeriodRequested = Boolean(
    payload.options?.manualPeriod ?? payload.options?.useManualPeriod
  );
  const manualSelection = payload.options?.manualSelection ??
    (manualPeriodRequested && payload.month && payload.year
      ? { month: payload.month, year: payload.year }
      : null);

  if (manualPeriodRequested && !manualSelection) {
    return NextResponse.json(
      { error: "Manual period was requested but month/year were not provided." },
      { status: 400 }
    );
  }

  try {
    const identityPairs = (payload.identity ?? []).map(({ token, record }) => ({
      token,
      record: normalizeIdentityRecord(record as IdentityRecord | undefined),
    }));

    const identityMap = new Map(identityPairs.map(({ token, record }) => [token, record]));

    const fileMetrics: FileMetric[] = [];
    const parsedWorkbooks: ParsedWorkbook[] = [];
    let totalDownloadMs = 0;
    let totalParseMs = 0;
    let totalPunches = 0;

    for (const file of payload.files) {
      ensureHttpsUrl(file.blobUrl);

      const downloadStart = performance.now();
      let response: Response;
      try {
        response = await fetch(file.blobUrl);
      } catch (error) {
        throw new Error(`Failed to download "${file.name}": ${(error as Error).message}`);
      }

      if (!response.ok) {
        throw new Error(`Failed to download "${file.name}" (status ${response.status}).`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const downloadMs = performance.now() - downloadStart;
      totalDownloadMs += downloadMs;

      if (arrayBuffer.byteLength > MAX_FILE_SIZE_BYTES) {
        throw new Error(`File "${file.name}" exceeds the maximum allowed size of 10 MB.`);
      }

      const parseStart = performance.now();
      const workbook = XLSX.read(new Uint8Array(arrayBuffer), {
        type: "array",
        cellDates: true,
      });

      if (workbook.SheetNames.length > MAX_SHEETS) {
        throw new Error(
          `File "${file.name}" has too many sheets (${workbook.SheetNames.length}).`
        );
      }

      const parsed = parseBioAttendance(workbook, { fileName: file.name });
      const parseMs = performance.now() - parseStart;
      totalParseMs += parseMs;

      if (parsed.days.length > MAX_ROWS) {
        throw new Error(
          `File "${file.name}" has too many rows (${parsed.days.length}).`
        );
      }

      if (parsed.totalPunches > MAX_TOTAL_PUNCHES) {
        throw new Error(
          `File "${file.name}" contains too many punches (${parsed.totalPunches}).`
        );
      }

      totalPunches += parsed.totalPunches;
      parsedWorkbooks.push(parsed as ParsedWorkbook);
      fileMetrics.push({
        id: file.id,
        name: file.name,
        size: file.size ?? arrayBuffer.byteLength,
        downloadMs,
        parseMs,
        rows: parsed.days.length,
        punches: parsed.totalPunches,
      });
    }

    if (!parsedWorkbooks.length) {
      return NextResponse.json({ perDay: [], perEmployee: [], metadata: null });
    }

    if (totalPunches > MAX_TOTAL_PUNCHES) {
      throw new Error("Combined punches exceed the supported limit.");
    }

    const mergeStart = performance.now();
    const mergeResult = mergeParsedWorkbooks(parsedWorkbooks);
    const mergeMs = performance.now() - mergeStart;

  const chronologicalRows = mergeResult.perDay.map((row) => toChronologicalRow(row));
    const basePerDay = sortPerDayRows(
    chronologicalRows.map((row) => {
      const token = row.employeeToken || row.employeeId || row.employeeName;
      if (!token) return row;
      const identity = identityMap.get(token);
      if (!identity) return row;
      const normalized = identity;
      const isUnmatched = normalized.status === "unmatched";
      const logName = row.employeeName?.trim();
      const employeeName =
        isUnmatched && logName?.length ? logName : normalized.employeeName || row.employeeName;
      const officeName = isUnmatched ? UNKNOWN_OFFICE_LABEL : normalized.officeName ?? null;
      const officeId = isUnmatched ? null : normalized.officeId ?? null;
      const employeeId = isUnmatched ? token : row.employeeId;

      return {
        ...row,
        employeeId,
        employeeName,
        resolvedEmployeeId: normalized.employeeId,
        officeId,
        officeName,
        identityStatus: normalized.status,
      };
    })
  );

    let filteredRows = basePerDay;
    if (manualPeriodRequested && manualSelection) {
    const filtered: ParsedPerDayRow[] = [];
    const { year, month } = manualSelection;
    const prefix = `${year}-${pad2(month)}`;

    for (const row of basePerDay) {
      if (row.composedFromDayOnly) {
        const manualDate = composeManualDate(year, month, row.day);
        if (!manualDate) {
          continue;
        }
        filtered.push(
          toChronologicalRow({
            ...row,
            dateISO: manualDate,
            day: Number(manualDate.slice(-2)),
          })
        );
        continue;
      }

      if (row.dateISO.startsWith(prefix)) {
        filtered.push(row);
      }
    }

      filteredRows = sortPerDayRows(filtered);
    }

    if (!filteredRows.length) {
      const metadata: EvaluationMetadata = {
        files: fileMetrics,
        totals: {
          files: fileMetrics.length,
          rows: 0,
          employees: 0,
          punches: 0,
          downloadMs: totalDownloadMs,
          parseMs: totalParseMs,
          mergeMs,
          evaluationMs: 0,
          manualPeriodApplied: manualPeriodRequested,
        },
      };
      return NextResponse.json({ perDay: [], perEmployee: [], metadata });
    }

    const entries = filteredRows.map((row) => ({
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      employeeToken: row.employeeToken,
    resolvedEmployeeId: row.resolvedEmployeeId ?? null,
    officeId: row.officeId ?? null,
    officeName: row.officeName ?? null,
    dateISO: row.dateISO,
    day: row.day,
    earliest: row.earliest,
    latest: row.latest,
    allTimes: row.allTimes,
    punches: row.punches,
      sourceFiles: row.sourceFiles,
    }));

    const bioIds = Array.from(new Set(entries.map((row) => row.employeeId)));

    const candidates: { id: string; employeeNo: string | null }[] = [];
    const CHUNK_SIZE = 200;
    for (let i = 0; i < bioIds.length; i += CHUNK_SIZE) {
      const slice = bioIds.slice(i, i + CHUNK_SIZE);
      const orConditions = slice.map((id) => ({ employeeNo: { startsWith: id } }));
      if (!orConditions.length) continue;
      const batch = await prisma.employee.findMany({
        where: { OR: orConditions },
        select: { id: true, employeeNo: true },
      });
      candidates.push(...batch);
    }

    const bioToInternal = new Map<string, string>();
    for (const candidate of candidates) {
      const token = firstEmployeeNoToken(candidate.employeeNo);
      if (token && !bioToInternal.has(token)) {
        bioToInternal.set(token, candidate.id);
      }
    }

    const sortedDates = entries.map((row) => row.dateISO).sort((a, b) => a.localeCompare(b));
    const firstDate = sortedDates[0];
    const lastDate = sortedDates[sortedDates.length - 1];

    const from = new Date(`${firstDate}T00:00:00.000Z`);
    const to = new Date(`${lastDate}T23:59:59.999Z`);

    const internalIds = Array.from(new Set(bioToInternal.values()));
    const maps = await getScheduleMapsForMonth(internalIds, { from, to });

    const evaluationStart = performance.now();
    const evaluatedPerDay: EvaluatedDay[] = entries.map((row) => {
      const internalEmployeeId = bioToInternal.get(row.employeeId) ?? null;
      const scheduleRecord = resolveScheduleForDate(internalEmployeeId, row.dateISO, maps);
      const normalized = normalizeSchedule(scheduleRecord);
      const earliest = (row.earliest ?? null) as HHMM | null;
      const latest = (row.latest ?? null) as HHMM | null;
      const normalizedAllTimes = normalizePunchTimes(row.allTimes);
      const identityToken = row.employeeToken || row.employeeId || row.employeeName || "";
      const identity = identityMap.get(identityToken);

      const evaluation = evaluateDay({
        dateISO: row.dateISO,
        earliest,
        latest,
        allTimes: normalizedAllTimes,
        schedule: normalized,
      });

      return {
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        resolvedEmployeeId: row.resolvedEmployeeId ?? null,
        officeId: row.officeId ?? null,
        officeName: row.officeName ?? null,
        day: row.day,
        earliest: row.earliest ?? null,
        latest: row.latest ?? null,
        allTimes: normalizedAllTimes,
        dateISO: row.dateISO,
        internalEmployeeId,
        status: evaluation.status,
        isLate: evaluation.isLate,
        isUndertime: evaluation.isUndertime,
        workedHHMM: evaluation.workedHHMM,
        workedMinutes: evaluation.workedMinutes,
        scheduleType: normalized.type,
        scheduleSource: scheduleRecord.source,
        punches: row.punches,
        sourceFiles: row.sourceFiles,
        employeeToken: row.employeeToken,
        lateMinutes: evaluation.lateMinutes ?? null,
        undertimeMinutes: evaluation.undertimeMinutes ?? null,
        requiredMinutes: evaluation.requiredMinutes ?? null,
        scheduleStart: evaluation.scheduleStart ?? null,
        scheduleEnd: evaluation.scheduleEnd ?? null,
        scheduleGraceMinutes: evaluation.scheduleGraceMinutes ?? null,
        weeklyPatternApplied: evaluation.weeklyPatternApplied ?? false,
        weeklyPatternWindows: evaluation.weeklyPatternWindows ?? null,
        weeklyPatternPresence: evaluation.weeklyPatternPresence ?? [],
        identityStatus: identity?.status ?? (internalEmployeeId ? "matched" : "unmatched"),
      };
    });
    const evaluationMs = performance.now() - evaluationStart;

    const perEmployee = summarizePerEmployee(evaluatedPerDay as unknown as PerDayRow[]);

    const metadata: EvaluationMetadata = {
      files: fileMetrics,
      totals: {
        files: fileMetrics.length,
        rows: evaluatedPerDay.length,
        employees: perEmployee.length,
        punches: filteredRows.reduce((sum, row) => sum + row.allTimes.length, 0),
        downloadMs: totalDownloadMs,
        parseMs: totalParseMs,
        mergeMs,
        evaluationMs,
        manualPeriodApplied: manualPeriodRequested,
      },
    };

    console.info("attendance-evaluate", {
      userId,
      files: fileMetrics.map((file) => ({
        id: file.id,
        name: file.name,
        size: file.size,
        downloadMs: Math.round(file.downloadMs),
        parseMs: Math.round(file.parseMs),
        rows: file.rows,
        punches: file.punches,
      })),
      totals: metadata.totals,
    });

    return NextResponse.json({ perDay: evaluatedPerDay, perEmployee, metadata });
  } catch (error) {
    console.error("Failed to evaluate attendance", error);
    const message =
      error instanceof Error ? error.message : "Failed to evaluate attendance.";
    const isClientError =
      /exceeds|too many|Failed to download|HTTPS|Manual period|Combined punches/.test(
        message
      );
    return NextResponse.json({ error: message }, { status: isClientError ? 400 : 500 });
  }
}

