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

  assert.equal(result.weeklyPatternApplied, true);
  assert.equal(result.workedMinutes, 480);
  assert.equal(result.isUndertime, false);
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

  assert.equal(result.weeklyPatternApplied, false);
  assert.equal(result.workedMinutes, 480);
  assert.equal(result.isUndertime, false);
  assert.equal(result.weeklyPatternWindows, null);
  assert.deepEqual(result.weeklyPatternPresence, []);
});
