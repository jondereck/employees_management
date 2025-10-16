import { strict as assert } from "node:assert";
import test from "node:test";

import { evaluateDay, type ScheduleFlex } from "../utils/evaluateDay";

const createFlexSchedule = (overrides: Partial<ScheduleFlex> = {}): ScheduleFlex => ({
  type: "FLEX",
  coreStart: "10:00",
  coreEnd: "15:00",
  bandwidthStart: "06:00",
  bandwidthEnd: "20:00",
  requiredDailyMinutes: 480,
  breakMinutes: 60,
  graceMinutes: 0,
  weeklyPattern: null,
  ...overrides,
});

test("weekly pattern clamps early punches for single window days", () => {
  const schedule = createFlexSchedule({
    weeklyPattern: {
      tue: {
        windows: [{ start: "15:00", end: "19:00" }],
        requiredMinutes: 240,
      },
    },
  });

  const result = evaluateDay({
    dateISO: "2024-07-09",
    earliest: "14:30",
    latest: "18:00",
    schedule,
  });

  assert.equal(result.status, "evaluated");
  assert.equal(result.weeklyPatternApplied, true);
  assert.equal(result.workedMinutes, 180);
  assert.equal(result.isUndertime, true);
  assert.equal(result.undertimeMinutes, 60);
  assert.deepEqual(result.weeklyPatternPresence, [{ start: "15:00", end: "18:00" }]);
});

test("weekly pattern supports split windows and ignores long breaks", () => {
  const schedule = createFlexSchedule({
    weeklyPattern: {
      mon: {
        windows: [
          { start: "08:00", end: "12:00" },
          { start: "15:00", end: "19:00" },
        ],
        requiredMinutes: 480,
      },
    },
  });

  const result = evaluateDay({
    dateISO: "2024-07-08",
    allTimes: ["07:30", "12:30", "14:00", "19:30"],
    schedule,
  });

  assert.equal(result.status, "evaluated");
  assert.equal(result.weeklyPatternApplied, true);
  assert.equal(result.workedMinutes, 480);
  assert.equal(result.isUndertime, false);
  assert.deepEqual(result.weeklyPatternPresence, [
    { start: "08:00", end: "12:00" },
    { start: "15:00", end: "19:00" },
  ]);
});

test("weekly pattern aggregates scattered weekend punches", () => {
  const schedule = createFlexSchedule({
    weeklyPattern: {
      sat: {
        windows: [{ start: "07:00", end: "19:00" }],
        requiredMinutes: 720,
      },
    },
  });

  const result = evaluateDay({
    dateISO: "2024-07-06",
    allTimes: ["06:30", "10:00", "11:00", "15:30", "16:00", "20:00"],
    schedule,
  });

  assert.equal(result.status, "evaluated");
  assert.equal(result.weeklyPatternApplied, true);
  assert.equal(result.workedMinutes, 630);
  assert.equal(result.isUndertime, true);
  assert.equal(result.undertimeMinutes, 90);
  assert.deepEqual(result.weeklyPatternPresence, [
    { start: "07:00", end: "10:00" },
    { start: "11:00", end: "15:30" },
    { start: "16:00", end: "19:00" },
  ]);
});

test("weekly pattern handles overnight windows spanning midnight", () => {
  const schedule = createFlexSchedule({
    weeklyPattern: {
      mon: {
        windows: [{ start: "22:00", end: "06:00" }],
        requiredMinutes: 480,
      },
    },
  });

  const result = evaluateDay({
    dateISO: "2024-07-08",
    earliest: "21:30",
    latest: "06:30",
    schedule,
  });

  assert.equal(result.status, "evaluated");
  assert.equal(result.weeklyPatternApplied, true);
  assert.equal(result.workedMinutes, 480);
  assert.equal(result.isUndertime, false);
  assert.equal(result.isLate, false);
  assert.equal(result.lateMinutes, 0);
  assert.deepEqual(result.weeklyPatternPresence, [
    { start: "00:00", end: "06:00" },
    { start: "22:00", end: "00:00" },
  ]);
});

test("flex schedules without weekly pattern keep legacy evaluation", () => {
  const schedule = createFlexSchedule({ weeklyPattern: null });

  const result = evaluateDay({
    dateISO: "2024-07-09",
    earliest: "09:00",
    latest: "18:00",
    schedule,
  });

  assert.equal(result.status, "evaluated");
  assert.equal(result.weeklyPatternApplied, false);
  assert.equal(result.workedMinutes, 480);
  assert.equal(result.isUndertime, false);
  assert.equal(result.weeklyPatternWindows, null);
  assert.deepEqual(result.weeklyPatternPresence, []);
});

test("weekly pattern late evaluation uses raw earliest punch", () => {
  const schedule = createFlexSchedule({
    graceMinutes: 0,
    weeklyPattern: {
      tue: {
        windows: [{ start: "15:00", end: "19:00" }],
        requiredMinutes: 240,
      },
    },
  });

  const result = evaluateDay({
    dateISO: "2024-07-09",
    allTimes: ["14:54", "19:37"],
    schedule,
  });

  assert.equal(result.status, "evaluated");
  assert.equal(result.isLate, false);
  assert.equal(result.lateMinutes, 0);
});

test("weekly pattern respects grace when computing lateness", () => {
  const schedule = createFlexSchedule({
    graceMinutes: 5,
    weeklyPattern: {
      tue: {
        windows: [{ start: "15:00", end: "19:00" }],
        requiredMinutes: 240,
      },
    },
  });

  const lateResult = evaluateDay({
    dateISO: "2024-07-09",
    allTimes: ["15:06", "19:00"],
    schedule,
  });

  assert.equal(lateResult.isLate, true);
  assert.equal(lateResult.lateMinutes, 1);

  const onTimeResult = evaluateDay({
    dateISO: "2024-07-09",
    allTimes: ["15:05", "18:30"],
    schedule,
  });

  assert.equal(onTimeResult.isLate, false);
  assert.equal(onTimeResult.lateMinutes, 0);
});

test("weekly pattern flags arrivals after core as late", () => {
  const schedule = createFlexSchedule({
    graceMinutes: 0,
    weeklyPattern: {
      wed: {
        windows: [{ start: "15:00", end: "19:00" }],
        requiredMinutes: 240,
      },
    },
  });

  const result = evaluateDay({
    dateISO: "2024-07-10",
    allTimes: ["15:12", "18:45"],
    schedule,
  });

  assert.equal(result.isLate, true);
  assert.equal(result.lateMinutes, 12);
});

test("weekly pattern treats days without punches as on time", () => {
  const schedule = createFlexSchedule({
    graceMinutes: 0,
    weeklyPattern: {
      thu: {
        windows: [{ start: "15:00", end: "19:00" }],
        requiredMinutes: 240,
      },
    },
  });

  const result = evaluateDay({
    dateISO: "2024-07-11",
    schedule,
  });

  assert.equal(result.status, "no_punch");
  assert.equal(result.isLate, false);
  assert.equal(result.isUndertime, false);
  assert.equal(result.lateMinutes, 0);
});

test("weekly pattern marks missed start on overnight windows as late", () => {
  const schedule = createFlexSchedule({
    graceMinutes: 0,
    weeklyPattern: {
      fri: {
        windows: [{ start: "22:00", end: "06:00" }],
        requiredMinutes: 240,
      },
    },
  });

  const result = evaluateDay({
    dateISO: "2024-07-12",
    allTimes: ["02:00", "06:00"],
    schedule,
  });

  assert.equal(result.isLate, true);
  assert.equal(result.lateMinutes, 240);
});

test("fixed schedule with no punches is marked as no_punch", () => {
  const result = evaluateDay({
    dateISO: "2024-09-07",
    schedule: {
      type: "FIXED",
      startTime: "08:00",
      endTime: "17:00",
      breakMinutes: 60,
      graceMinutes: 15,
    },
  });

  assert.equal(result.status, "no_punch");
  assert.equal(result.isLate, false);
  assert.equal(result.isUndertime, false);
  assert.equal(result.workedMinutes, 0);
  assert.equal(result.workedHHMM, "00:00");
  assert.equal(result.lateMinutes, 0);
  assert.equal(result.undertimeMinutes, 0);
  assert.equal(result.requiredMinutes, null);
});

test("flex schedule treats invalid punches as no_punch", () => {
  const schedule = createFlexSchedule({ weeklyPattern: null });

  const result = evaluateDay({
    dateISO: "2024-09-08",
    allTimes: ["-", ""],
    earliest: null,
    latest: null,
    schedule,
  });

  assert.equal(result.status, "no_punch");
  assert.equal(result.isLate, false);
  assert.equal(result.isUndertime, false);
  assert.equal(result.workedMinutes, 0);
  assert.equal(result.workedHHMM, "00:00");
});
