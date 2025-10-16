import { strict as assert } from "node:assert";
import test from "node:test";

import { normalizeWeeklyPattern, sortWeeklyPatternWindows } from "../utils/weeklyPattern";

test("sortWeeklyPatternWindows orders windows chronologically", () => {
  const result = sortWeeklyPatternWindows([
    { start: "15:00", end: "19:00" },
    { start: "08:00", end: "12:00" },
    { start: "22:00", end: "06:00" },
  ]);

  assert.deepEqual(result, [
    { start: "22:00", end: "06:00" },
    { start: "08:00", end: "12:00" },
    { start: "15:00", end: "19:00" },
  ]);
});

test("normalizeWeeklyPattern sorts persisted windows", () => {
  const normalized = normalizeWeeklyPattern({
    mon: {
      windows: [
        { start: "15:00", end: "19:00" },
        { start: "08:00", end: "12:00" },
        { start: "22:00", end: "06:00" },
      ],
      requiredMinutes: 600,
    },
  });

  assert(normalized);
  assert.deepEqual(normalized.mon?.windows, [
    { start: "22:00", end: "06:00" },
    { start: "08:00", end: "12:00" },
    { start: "15:00", end: "19:00" },
  ]);
});
