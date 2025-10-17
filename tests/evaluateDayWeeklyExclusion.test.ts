import { strict as assert } from "node:assert";
import test from "node:test";

import { evaluateDay, type ScheduleFixed, type ScheduleFlex } from "../utils/evaluateDay";

const createFixedSchedule = (overrides: Partial<ScheduleFixed> = {}): ScheduleFixed => ({
  type: "FIXED",
  startTime: "08:00",
  endTime: "17:00",
  breakMinutes: 60,
  graceMinutes: 0,
  ...overrides,
});

const createFlexSchedule = (overrides: Partial<ScheduleFlex> = {}): ScheduleFlex => ({
  type: "FLEX",
  coreStart: "09:00",
  coreEnd: "15:00",
  bandwidthStart: "06:00",
  bandwidthEnd: "20:00",
  requiredDailyMinutes: 480,
  breakMinutes: 60,
  graceMinutes: 0,
  weeklyPattern: null,
  ...overrides,
});

const toMinutes = (hhmm: string) => {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return hours * 60 + minutes;
};

test("weekly exclusion marks day as excused", () => {
  const schedule = createFixedSchedule();

  const result = evaluateDay({
    dateISO: "2024-07-08",
    earliest: "08:45",
    latest: "17:00",
    schedule,
    weeklyExclusion: { mode: "EXCUSED", ignoreUntilMinutes: null },
  });

  assert.equal(result.status, "excused");
  assert.equal(result.isLate, false);
  assert.equal(result.isUndertime, false);
  assert.equal(result.weeklyExclusionApplied?.mode, "EXCUSED");
});

test("ignore lateness until adjusts fixed schedule threshold", () => {
  const schedule = createFixedSchedule({ graceMinutes: 5 });

  const result = evaluateDay({
    dateISO: "2024-07-09",
    earliest: "08:28",
    latest: "17:00",
    schedule,
    weeklyExclusion: { mode: "IGNORE_LATE_UNTIL", ignoreUntilMinutes: toMinutes("08:30") },
  });

  assert.equal(result.status, "evaluated");
  assert.equal(result.isLate, false);
  assert.equal(result.lateMinutes, 0);
  assert.equal(result.weeklyExclusionApplied?.mode, "IGNORE_LATE_UNTIL");
  assert.equal(result.scheduleStart, "08:30");
});

test("ignore lateness until still flags late after threshold", () => {
  const schedule = createFixedSchedule({ graceMinutes: 0 });

  const result = evaluateDay({
    dateISO: "2024-07-10",
    earliest: "08:45",
    latest: "17:00",
    schedule,
    weeklyExclusion: { mode: "IGNORE_LATE_UNTIL", ignoreUntilMinutes: toMinutes("08:30") },
  });

  assert.equal(result.isLate, true);
  assert.equal(result.lateMinutes, 15);
});

test("ignore lateness applies to flex weekly pattern", () => {
  const schedule = createFlexSchedule({
    weeklyPattern: {
      wed: {
        windows: [{ start: "09:00", end: "15:00" }],
        requiredMinutes: 360,
      },
    },
  });

  const result = evaluateDay({
    dateISO: "2024-07-10",
    allTimes: ["09:25", "15:10"],
    schedule,
    weeklyExclusion: { mode: "IGNORE_LATE_UNTIL", ignoreUntilMinutes: toMinutes("09:30") },
  });

  assert.equal(result.isLate, false);
  assert.equal(result.scheduleStart, "09:30");
  assert.equal(result.weeklyExclusionApplied?.ignoreUntil, "09:30");
});
