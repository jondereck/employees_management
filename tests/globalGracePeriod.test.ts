import { strict as assert } from "node:assert";
import test from "node:test";

import { POST as evaluateAttendancePost } from "../app/api/attendance/evaluate/route";
import { applyGlobalScheduleGrace } from "../lib/attendance/evaluateEntries";
import type { WorkSchedule } from "../types/attendance";
import { evaluateDay, type ScheduleFixed } from "../utils/evaluateDay";

const globalSchedule: WorkSchedule = {
  startTime: "07:00",
  endTime: "18:00",
  workingDays: [1, 2, 3, 4],
  graceMinutes: 5,
};

const evaluateFixedArrival = (startTime: ScheduleFixed["startTime"], earliest: ScheduleFixed["startTime"]) => {
  const schedule = applyGlobalScheduleGrace<ScheduleFixed>(
    {
      type: "FIXED",
      startTime,
      endTime: "18:00",
      breakMinutes: 60,
      graceMinutes: 0,
    },
    globalSchedule
  );

  return evaluateDay({
    dateISO: "2026-06-01",
    earliest,
    latest: "18:00",
    allTimes: [earliest, "18:00"],
    schedule,
  });
};

test("global analyzer grace keeps exact threshold arrivals on time", () => {
  const sevenStart = evaluateFixedArrival("07:00", "07:05");
  assert.equal(sevenStart.isLate, false);
  assert.equal(sevenStart.lateMinutes, 0);
  assert.equal(sevenStart.scheduleGraceMinutes, 5);

  const eightStart = evaluateFixedArrival("08:00", "08:05");
  assert.equal(eightStart.isLate, false);
  assert.equal(eightStart.lateMinutes, 0);
  assert.equal(eightStart.scheduleGraceMinutes, 5);
});

test("global analyzer grace marks arrivals after the threshold late by the excess minutes", () => {
  const sevenStart = evaluateFixedArrival("07:00", "07:06");
  assert.equal(sevenStart.isLate, true);
  assert.equal(sevenStart.lateMinutes, 1);
  assert.equal(sevenStart.scheduleGraceMinutes, 5);
});

test("attendance evaluation API rejects invalid global grace values", async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const response = await evaluateAttendancePost(
      new Request("http://localhost/api/attendance/evaluate", {
        method: "POST",
        body: JSON.stringify({
          entries: [],
          evaluationOptions: {
            overtime: {},
            workSchedule: {
              startTime: "07:00",
              endTime: "18:00",
              workingDays: [1, 2, 3, 4],
              graceMinutes: 181,
            },
          },
        }),
      })
    );

    assert.equal(response.status, 400);
  } finally {
    console.error = originalError;
  }
});
