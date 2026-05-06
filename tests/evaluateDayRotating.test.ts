import { strict as assert } from "node:assert";
import test from "node:test";

import { evaluateDay, type ScheduleRotating } from "../utils/evaluateDay";

const schedule: ScheduleRotating = {
  type: "ROTATING",
  rotationAnchorDate: "2024-07-01",
  breakMinutes: 60,
  graceMinutes: 0,
  rotationPattern: {
    days: [
      { kind: "WORK", start: "06:00", end: "18:00" },
      { kind: "OFF" },
      { kind: "WORK", start: "07:00", end: "19:00" },
      { kind: "OFF" },
    ],
  },
};

test("rotating schedule repeats a four-day work/off cycle", () => {
  const firstWork = evaluateDay({
    dateISO: "2024-07-01",
    earliest: "06:00",
    latest: "18:00",
    schedule,
  });
  assert.equal(firstWork.status, "evaluated");
  assert.equal(firstWork.scheduleStart, "06:00");
  assert.equal(firstWork.scheduleEnd, "18:00");
  assert.equal(firstWork.workedMinutes, 660);
  assert.equal(firstWork.isUndertime, false);

  const offDay = evaluateDay({
    dateISO: "2024-07-02",
    schedule,
  });
  assert.equal(offDay.status, "off");
  assert.equal(offDay.isLate, false);
  assert.equal(offDay.isUndertime, false);
  assert.equal(offDay.requiredMinutes, null);

  const secondWork = evaluateDay({
    dateISO: "2024-07-03",
    earliest: "07:00",
    latest: "19:00",
    schedule,
  });
  assert.equal(secondWork.status, "evaluated");
  assert.equal(secondWork.scheduleStart, "07:00");
  assert.equal(secondWork.scheduleEnd, "19:00");
  assert.equal(secondWork.workedMinutes, 660);
});

test("rotating schedule flips weekdays across weeks", () => {
  const mondayWeekOne = evaluateDay({
    dateISO: "2024-07-01",
    earliest: "06:00",
    latest: "18:00",
    schedule,
  });
  const mondayWeekTwo = evaluateDay({
    dateISO: "2024-07-08",
    schedule,
  });

  assert.equal(mondayWeekOne.status, "evaluated");
  assert.equal(mondayWeekTwo.status, "off");
});

test("rotating work day supports per-day break and grace defaults", () => {
  const result = evaluateDay({
    dateISO: "2024-07-01",
    earliest: "06:10",
    latest: "18:00",
    schedule: {
      ...schedule,
      graceMinutes: 15,
      rotationPattern: {
        days: [
          { kind: "WORK", start: "06:00", end: "18:00", breakMinutes: 30 },
          { kind: "OFF" },
        ],
      },
    },
  });

  assert.equal(result.isLate, false);
  assert.equal(result.scheduleGraceMinutes, 15);
  assert.equal(result.workedMinutes, 680);
  assert.equal(result.requiredMinutes, 690);
  assert.equal(result.isUndertime, true);
});

test("rotating overnight work day is evaluated across midnight", () => {
  const result = evaluateDay({
    dateISO: "2024-07-01",
    earliest: "18:00",
    latest: "06:00",
    schedule: {
      type: "ROTATING",
      rotationAnchorDate: "2024-07-01",
      breakMinutes: 60,
      rotationPattern: {
        days: [
          { kind: "WORK", start: "18:00", end: "06:00" },
          { kind: "OFF" },
        ],
      },
    },
  });

  assert.equal(result.status, "evaluated");
  assert.equal(result.scheduleStart, "18:00");
  assert.equal(result.scheduleEnd, "06:00");
  assert.equal(result.workedMinutes, 660);
  assert.equal(result.requiredMinutes, 660);
  assert.equal(result.isUndertime, false);
});

test("weekly exclusion does not override a rotating off day", () => {
  const result = evaluateDay({
    dateISO: "2024-07-02",
    schedule,
    weeklyExclusion: { mode: "EXCUSED", ignoreUntilMinutes: null },
  });

  assert.equal(result.status, "off");
  assert.equal(result.weeklyExclusionApplied, null);
});

