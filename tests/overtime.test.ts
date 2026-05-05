import { strict as assert } from "node:assert";
import test from "node:test";

import { computeOvertimeForDay } from "../lib/attendance/overtime";
import {
  stitchOvernightCarryoverEntries,
  type EvaluationEntry,
} from "../lib/attendance/evaluateEntries";
import { summarizePerEmployee, type PerDayRow } from "../utils/parseBioAttendance";
import type { OvertimePolicy } from "../types/attendance";

const basePolicy: OvertimePolicy = {
  rounding: "none",
  graceAfterEndMin: 60,
  overnightCarryoverCutoffMin: 360,
  countPreShift: false,
  minBlockMin: 0,
  mealDeductMin: undefined,
  mealTriggerMin: undefined,
  nightDiffEnabled: false,
  flexMode: "strict",
  overtimeOnExcused: true,
};

test("fixed schedule excludes the first hour after shift end from post OT", () => {
  const result = computeOvertimeForDay({
    schedule: {
      type: "FIXED",
      startTime: "07:00",
      endTime: "18:00",
      breakMinutes: 60,
      graceMinutes: 0,
    },
    presence: [{ start: 7 * 60, end: 19 * 60 }],
    policy: basePolicy,
    holiday: "none",
  });

  assert.equal(result.OT_post, 0);
  assert.equal(result.OT_total, 0);
});

test("fixed schedule counts post OT only after the configured delay", () => {
  const result = computeOvertimeForDay({
    schedule: {
      type: "FIXED",
      startTime: "07:00",
      endTime: "18:00",
      breakMinutes: 60,
      graceMinutes: 0,
    },
    presence: [{ start: 7 * 60, end: 20 * 60 }],
    policy: basePolicy,
    holiday: "none",
  });

  assert.equal(result.OT_post, 60);
  assert.equal(result.OT_total, 60);
  assert.equal(result.trace?.postShiftStart, "19:00");
});

test("overnight carryover stitching reassigns the leading next-day punch to the previous date", () => {
  const rows: Array<{
    row: EvaluationEntry & { preEvaluationNotes?: string[] };
    resolvedEmployeeId: string | null;
    officeId: string | null;
  }> = [
    {
      row: {
        employeeId: "7520007",
        employeeName: "JIMENEZ, KEITH VINCENT A.",
        employeeToken: "7520007",
        resolvedEmployeeId: "emp-1",
        officeId: "office-1",
        officeName: "Municipal Engineering Office",
        dateISO: "2026-03-16",
        day: 16,
        earliest: "06:55",
        latest: "18:27",
        allTimes: ["06:55", "15:27", "18:27"],
        punches: [
          { time: "06:55", minuteOfDay: 6 * 60 + 55, source: "original", files: ["sample.xlsx"] },
          { time: "15:27", minuteOfDay: 15 * 60 + 27, source: "original", files: ["sample.xlsx"] },
          { time: "18:27", minuteOfDay: 18 * 60 + 27, source: "original", files: ["sample.xlsx"] },
        ],
        sourceFiles: ["sample.xlsx"],
        composedFromDayOnly: false,
      },
      resolvedEmployeeId: "emp-1",
      officeId: "office-1",
    },
    {
      row: {
        employeeId: "7520007",
        employeeName: "JIMENEZ, KEITH VINCENT A.",
        employeeToken: "7520007",
        resolvedEmployeeId: "emp-1",
        officeId: "office-1",
        officeName: "Municipal Engineering Office",
        dateISO: "2026-03-17",
        day: 17,
        earliest: "00:03",
        latest: "18:22",
        allTimes: ["00:03", "06:55", "12:00", "13:00", "18:22"],
        punches: [
          { time: "00:03", minuteOfDay: 3, source: "original", files: ["sample.xlsx"] },
          { time: "06:55", minuteOfDay: 6 * 60 + 55, source: "original", files: ["sample.xlsx"] },
          { time: "12:00", minuteOfDay: 12 * 60, source: "original", files: ["sample.xlsx"] },
          { time: "13:00", minuteOfDay: 13 * 60, source: "original", files: ["sample.xlsx"] },
          { time: "18:22", minuteOfDay: 18 * 60 + 22, source: "original", files: ["sample.xlsx"] },
        ],
        sourceFiles: ["sample.xlsx"],
        composedFromDayOnly: false,
      },
      resolvedEmployeeId: "emp-1",
      officeId: "office-1",
    },
  ];

  const stitched = stitchOvernightCarryoverEntries(rows, {
    cutoffMinutes: 6 * 60,
    getScheduleEndMinutes: () => 18 * 60,
  });

  assert.deepEqual(stitched[0]?.allTimes, ["06:55", "15:27", "18:27", "00:03"]);
  assert.equal(stitched[0]?.latest, "00:03");
  assert.deepEqual(stitched[1]?.allTimes, ["06:55", "12:00", "13:00", "18:22"]);
  assert.equal(stitched[1]?.earliest, "06:55");
  assert.ok(stitched[0]?.preEvaluationNotes?.some((note) => note.includes("Included 1 overnight carryover punch")));
  assert.ok(stitched[1]?.preEvaluationNotes?.some((note) => note.includes("Reassigned 1 overnight carryover punch")));
});

test("aggressive overnight carryover moves the first eligible next-day punch even if the day becomes incomplete", () => {
  const rows: Array<{
    row: EvaluationEntry & { preEvaluationNotes?: string[] };
    resolvedEmployeeId: string | null;
    officeId: string | null;
  }> = [
    {
      row: {
        employeeId: "7520007",
        employeeName: "JIMENEZ, KEITH VINCENT A.",
        employeeToken: "7520007",
        resolvedEmployeeId: "emp-1",
        officeId: "office-1",
        officeName: "Municipal Engineering Office",
        dateISO: "2026-03-16",
        day: 16,
        earliest: "06:55",
        latest: "18:27",
        allTimes: ["06:55", "15:27", "18:27"],
        punches: [],
        sourceFiles: ["sample.xlsx"],
        composedFromDayOnly: false,
      },
      resolvedEmployeeId: "emp-1",
      officeId: "office-1",
    },
    {
      row: {
        employeeId: "7520007",
        employeeName: "JIMENEZ, KEITH VINCENT A.",
        employeeToken: "7520007",
        resolvedEmployeeId: "emp-1",
        officeId: "office-1",
        officeName: "Municipal Engineering Office",
        dateISO: "2026-03-17",
        day: 17,
        earliest: "00:03",
        latest: "18:22",
        allTimes: ["00:03", "18:22"],
        punches: [],
        sourceFiles: ["sample.xlsx"],
        composedFromDayOnly: false,
      },
      resolvedEmployeeId: "emp-1",
      officeId: "office-1",
    },
  ];

  const stitched = stitchOvernightCarryoverEntries(rows, {
    cutoffMinutes: 6 * 60,
    getScheduleEndMinutes: () => 18 * 60,
  });

  assert.deepEqual(stitched[0]?.allTimes, ["06:55", "15:27", "18:27", "00:03"]);
  assert.deepEqual(stitched[1]?.allTimes, ["18:22"]);
  assert.ok(
    stitched[1]?.preEvaluationNotes?.some((note) =>
      note.includes("Carryover left this day with an incomplete punch sequence.")
    )
  );
});

test("manual overnight carryover override forces the first next-day punch back to the previous date", () => {
  const rows: Array<{
    row: EvaluationEntry & { preEvaluationNotes?: string[] };
    resolvedEmployeeId: string | null;
    officeId: string | null;
  }> = [
    {
      row: {
        employeeId: "7520007",
        employeeName: "JIMENEZ, KEITH VINCENT A.",
        employeeToken: "7520007",
        resolvedEmployeeId: "emp-1",
        officeId: "office-1",
        officeName: "Municipal Engineering Office",
        dateISO: "2026-03-16",
        day: 16,
        earliest: "06:55",
        latest: "18:27",
        allTimes: ["06:55", "15:27", "18:27"],
        punches: [],
        sourceFiles: ["sample.xlsx"],
        composedFromDayOnly: false,
      },
      resolvedEmployeeId: "emp-1",
      officeId: "office-1",
    },
    {
      row: {
        employeeId: "7520007",
        employeeName: "JIMENEZ, KEITH VINCENT A.",
        employeeToken: "7520007",
        resolvedEmployeeId: "emp-1",
        officeId: "office-1",
        officeName: "Municipal Engineering Office",
        dateISO: "2026-03-17",
        day: 17,
        earliest: "07:30",
        latest: "18:22",
        allTimes: ["07:30", "18:22"],
        punches: [],
        sourceFiles: ["sample.xlsx"],
        composedFromDayOnly: false,
      },
      resolvedEmployeeId: "emp-1",
      officeId: "office-1",
    },
  ];

  const stitched = stitchOvernightCarryoverEntries(rows, {
    cutoffMinutes: 6 * 60,
    getScheduleEndMinutes: () => 18 * 60,
    manualOverrideKeys: new Set(["7520007::2026-03-17"]),
  });

  assert.deepEqual(stitched[0]?.allTimes, ["06:55", "15:27", "18:27", "07:30"]);
  assert.deepEqual(stitched[1]?.allTimes, ["18:22"]);
  assert.ok(stitched[0]?.preEvaluationNotes?.some((note) => note.includes("Manually carried 1 overnight punch")));
});

test("minimum OT block is applied after the post-shift delay", () => {
  const result = computeOvertimeForDay({
    schedule: {
      type: "FIXED",
      startTime: "07:00",
      endTime: "18:00",
      breakMinutes: 60,
      graceMinutes: 0,
    },
    presence: [{ start: 7 * 60, end: 20 * 60 }],
    policy: { ...basePolicy, minBlockMin: 120 },
    holiday: "none",
  });

  assert.equal(result.OT_post, 0);
  assert.equal(result.OT_total, 0);
  assert.equal(result.trace?.rawPostMinutes, 60);
  assert.equal(result.trace?.thresholdedPostMinutes, 0);
});

test("meal deduction applies to the rounded daily OT total", () => {
  const result = computeOvertimeForDay({
    schedule: {
      type: "FIXED",
      startTime: "07:00",
      endTime: "18:00",
      breakMinutes: 60,
      graceMinutes: 0,
    },
    presence: [{ start: 7 * 60, end: 23 * 60 }],
    policy: { ...basePolicy, mealDeductMin: 60, mealTriggerMin: 180 },
    holiday: "none",
  });

  assert.equal(result.OT_post, 240);
  assert.equal(result.OT_total, 180);
  assert.equal(result.trace?.mealApplied, true);
  assert.equal(result.trace?.mealDeductedMinutes, 60);
});

test("meal deduction also applies to rest-day overtime buckets", () => {
  const result = computeOvertimeForDay({
    schedule: {
      type: "FIXED",
      startTime: "07:00",
      endTime: "18:00",
      breakMinutes: 60,
      graceMinutes: 0,
    },
    presence: [{ start: 7 * 60, end: 17 * 60 }],
    policy: { ...basePolicy, mealDeductMin: 60, mealTriggerMin: 180 },
    holiday: "restday",
  });

  assert.equal(result.OT_restday, 540);
  assert.equal(result.OT_total, 540);
  assert.equal(result.trace?.mealApplied, true);
  assert.equal(result.trace?.mealDeductedMinutes, 60);
});

test("overnight post OT is split between the current date and the next date", () => {
  const result = computeOvertimeForDay({
    schedule: {
      type: "FIXED",
      startTime: "07:00",
      endTime: "18:00",
      breakMinutes: 60,
      graceMinutes: 0,
    },
    presence: [
      { start: 7 * 60, end: 24 * 60 },
      { start: 0, end: 2 * 60 },
    ],
    policy: { ...basePolicy, nightDiffEnabled: true },
    holiday: "none",
  });

  assert.equal(result.OT_post, 300);
  assert.equal(result.OT_total, 300);
  assert.equal(result.ND_minutes, 120);
  assert.ok(result.spillover);
  assert.equal(result.spillover?.OT_post, 120);
  assert.equal(result.spillover?.OT_total, 120);
  assert.equal(result.spillover?.ND_minutes, 120);
});

test("trace captures deterministic post OT math for long days", () => {
  const result = computeOvertimeForDay({
    schedule: {
      type: "FIXED",
      startTime: "07:00",
      endTime: "18:00",
      breakMinutes: 60,
      graceMinutes: 0,
    },
    presence: [{ start: 7 * 60 + 1, end: 23 * 60 + 3 }],
    policy: { ...basePolicy, minBlockMin: 120 },
    holiday: "none",
  });

  assert.equal(result.OT_post, 243);
  assert.equal(result.trace?.rawPostMinutes, 243);
  assert.equal(result.trace?.roundedPostMinutes, 243);
  assert.equal(result.trace?.postShiftStart, "19:00");
});

test("synthetic spillover rows contribute OT without inflating attendance day counts", () => {
  const rows: PerDayRow[] = [
    {
      employeeId: "7520007",
      employeeToken: "7520007",
      employeeName: "JIMENEZ, KEITH VINCENT A.",
      employeeNo: "7520007",
      resolvedEmployeeId: "emp-1",
      officeId: "office-1",
      officeName: "Municipal Engineering Office",
      employeeType: null,
      dateISO: "2026-03-10",
      day: 10,
      earliest: "07:01",
      latest: "23:03",
      allTimes: ["07:01", "23:03"],
      punches: [],
      sourceFiles: ["sample.xlsx"],
      composedFromDayOnly: false,
      status: "Present",
      evaluationStatus: "evaluated",
      isLate: false,
      isUndertime: false,
      workedHHMM: "15:02",
      workedMinutes: 902,
      OT_pre: 0,
      OT_post: 300,
      OT_restday: 0,
      OT_holiday: 0,
      OT_excused: 0,
      OT_total: 300,
      ND_minutes: 120,
      absent: false,
      scheduleType: "FIXED",
      scheduleSource: "DEFAULT",
      lateMinutes: 0,
      undertimeMinutes: 0,
      requiredMinutes: 600,
      scheduleStart: "07:00",
      scheduleEnd: "18:00",
      scheduleGraceMinutes: 0,
      identityStatus: "matched",
      isHead: false,
      weeklyPatternApplied: false,
    },
    {
      employeeId: "7520007",
      employeeToken: "7520007",
      employeeName: "JIMENEZ, KEITH VINCENT A.",
      employeeNo: "7520007",
      resolvedEmployeeId: "emp-1",
      officeId: "office-1",
      officeName: "Municipal Engineering Office",
      employeeType: null,
      dateISO: "2026-03-11",
      day: 11,
      earliest: "00:00",
      latest: "02:00",
      allTimes: [],
      punches: [],
      sourceFiles: ["sample.xlsx"],
      composedFromDayOnly: false,
      status: "OT spillover",
      evaluationStatus: "no_punch",
      isLate: false,
      isUndertime: false,
      workedHHMM: null,
      workedMinutes: 0,
      OT_pre: 0,
      OT_post: 120,
      OT_restday: 0,
      OT_holiday: 0,
      OT_excused: 0,
      OT_total: 120,
      ND_minutes: 120,
      absent: false,
      scheduleType: "FIXED",
      scheduleSource: "DEFAULT",
      lateMinutes: null,
      undertimeMinutes: null,
      requiredMinutes: null,
      scheduleStart: null,
      scheduleEnd: null,
      scheduleGraceMinutes: null,
      identityStatus: "matched",
      isHead: false,
      weeklyPatternApplied: false,
      excludeFromSummaryCounts: true,
      spilloverFromDateISO: "2026-03-10",
    },
  ];

  const [summary] = summarizePerEmployee(rows);
  assert.ok(summary);
  assert.equal(summary.daysWithLogs, 1);
  assert.equal(summary.noPunchDays, 0);
  assert.equal(summary.totalOTMinutes, 420);
  assert.equal(summary.totalOTPostMinutes, 420);
});
