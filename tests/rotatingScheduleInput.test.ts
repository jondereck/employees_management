import { strict as assert } from "node:assert";
import test from "node:test";

import {
  normalizeRotationPatternInput,
  rotationPatternSchema,
} from "../lib/rotatingScheduleInput";

test("rotation input accepts a valid custom cycle", () => {
  const parsed = rotationPatternSchema.parse({
    days: [
      { kind: "WORK", start: "06:00", end: "18:00", breakMinutes: 60, graceMinutes: 5 },
      { kind: "OFF" },
      { kind: "WORK", start: "07:00", end: "19:00" },
      { kind: "OFF" },
    ],
  });

  assert.equal(parsed.days.length, 4);
  assert.equal(parsed.days[0].kind, "WORK");
});

test("rotation input rejects cycles without a work day", () => {
  assert.throws(() =>
    rotationPatternSchema.parse({
      days: [{ kind: "OFF" }, { kind: "OFF" }],
    })
  );
});

test("rotation input rejects matching start and end times", () => {
  assert.throws(() =>
    rotationPatternSchema.parse({
      days: [
        { kind: "WORK", start: "06:00", end: "06:00" },
        { kind: "OFF" },
      ],
    })
  );
});

test("rotation sanitizer clamps optional break and grace values", () => {
  const normalized = normalizeRotationPatternInput({
    days: [
      { kind: "WORK", start: "06:00", end: "18:00", breakMinutes: 999, graceMinutes: 999 },
      { kind: "OFF" },
    ],
  });

  assert.equal(normalized?.days[0].kind, "WORK");
  if (normalized?.days[0].kind === "WORK") {
    assert.equal(normalized.days[0].breakMinutes, 720);
    assert.equal(normalized.days[0].graceMinutes, 180);
  }
});

