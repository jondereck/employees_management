import { strict as assert } from "node:assert";
import test from "node:test";

import { evaluateDay } from "../utils/evaluateDay";
import type { ScheduleFlex } from "../utils/evaluateDay";
import type { WeeklyPattern } from "../utils/weeklyPattern";

const baseFlex: ScheduleFlex = {
  type: "FLEX",
  coreStart: "10:00",
  coreEnd: "15:00",
  bandwidthStart: "06:00",
  bandwidthEnd: "20:00",
  requiredDailyMinutes: 480,
  breakMinutes: 60,
};

const makeFlex = (pattern: WeeklyPattern): ScheduleFlex => ({
  ...baseFlex,
  weeklyPattern: pattern,
});

test("weekly pattern single window clamps work minutes", () => {
  const schedule = makeFlex({
    tue: {
      windows: [{ start: "15:00", end: "19:00" }],
      requiredMinutes: 240,
    },
  });

  const resultFull = evaluateDay({
    dateISO: "2024-09-17",
    earliest: "15:00",
    latest: "19:00",
    allTimes: ["15:00", "19:00"],
    schedule,
  });

  assert.equal(resultFull.workedMinutes, 240);
  assert.equal(resultFull.isUndertime, false);
  assert.equal(resultFull.weeklyPattern?.workedSegments.length, 1);

  const resultEarlyOut = evaluateDay({
    dateISO: "2024-09-17",
    earliest: "15:00",
    latest: "18:00",
    allTimes: ["15:00", "18:00"],
    schedule,
  });

  assert.equal(resultEarlyOut.workedMinutes, 180);
  assert.equal(resultEarlyOut.isUndertime, true);
  assert.equal(resultEarlyOut.undertimeMinutes, 60);
});

test("weekly pattern split windows ignores gaps", () => {
  const schedule = makeFlex({
    mon: {
      windows: [
        { start: "08:00", end: "12:00" },
        { start: "15:00", end: "19:00" },
      ],
      requiredMinutes: 480,
    },
  });

  const result = evaluateDay({
    dateISO: "2024-09-16",
    earliest: "07:30",
    latest: "19:30",
    allTimes: ["07:30", "12:00", "13:00", "19:30"],
    schedule,
  });

  assert.equal(result.workedMinutes, 480);
  assert.equal(result.isUndertime, false);
  assert.equal(result.weeklyPattern?.workedSegments.length, 2);
});

test("weekly pattern accumulates scattered punches within long window", () => {
  const schedule = makeFlex({
    sat: {
      windows: [{ start: "07:00", end: "19:00" }],
      requiredMinutes: 720,
    },
  });

  const result = evaluateDay({
    dateISO: "2024-09-21",
    earliest: "06:30",
    latest: "20:00",
    allTimes: ["06:30", "19:30"],
    schedule,
  });

  assert.equal(result.workedMinutes, 720);
  assert.equal(result.isUndertime, false);
});

test("weekly pattern handles overnight windows", () => {
  const schedule = makeFlex({
    mon: {
      windows: [{ start: "22:00", end: "06:00" }],
      requiredMinutes: 480,
    },
  });

  const result = evaluateDay({
    dateISO: "2024-09-16",
    earliest: "22:00",
    latest: "06:00",
    allTimes: ["22:00", "06:00"],
    schedule,
  });

  assert.equal(result.workedMinutes, 480);
  assert.equal(result.isUndertime, false);
  assert.equal(result.weeklyPattern?.workedSegments.length, 2);
});

test("flex schedule without weekly pattern keeps legacy behaviour", () => {
  const result = evaluateDay({
    dateISO: "2024-09-18",
    earliest: "09:00",
    latest: "17:00",
    allTimes: ["09:00", "17:00"],
    schedule: baseFlex,
  });

  assert.equal(result.weeklyPattern, null);
});
