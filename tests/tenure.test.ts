import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeTenure, formatTenureShort } from "@/utils/tenure";

describe("tenure utility", () => {
  it("formats short tenure with correct units and plurals", () => {
    assert.equal(formatTenureShort({ years: 0, months: 0, days: 0 }), "0 days");
    assert.equal(formatTenureShort({ years: 0, months: 0, days: 1 }), "1 day");
    assert.equal(formatTenureShort({ years: 0, months: 1, days: 0 }), "1 mo");
    assert.equal(formatTenureShort({ years: 0, months: 8, days: 12 }), "8 mos");
    assert.equal(formatTenureShort({ years: 1, months: 3, days: 0 }), "1 yr");
    assert.equal(formatTenureShort({ years: 5, months: 0, days: 0 }), "5 yrs");
  });

  it("handles single continuous service", () => {
    const result = computeTenure(
      {
        dateHired: "2020-01-01",
        latestAppointment: "2020-01-01",
        isArchived: false,
        employmentEvents: [
          { type: "HIRED", occurredAt: "2020-01-01" },
        ],
      },
      new Date("2025-01-01T00:00:00.000Z")
    );

    assert.equal(result.totalServiceYears, 5);
    assert.equal(result.currentAppointmentYears, 5);
  });

  it("excludes inactive gap for hire terminate rehire", () => {
    const result = computeTenure(
      {
        dateHired: "2018-01-01",
        latestAppointment: "2023-01-01",
        isArchived: false,
        employmentEvents: [
          { type: "HIRED", occurredAt: "2018-01-01" },
          { type: "TERMINATED", occurredAt: "2020-01-01" },
          { type: "HIRED", occurredAt: "2023-01-01" },
        ],
      },
      new Date("2025-01-01T00:00:00.000Z")
    );

    assert.equal(result.totalServiceYears, 4);
    assert.equal(result.currentAppointmentYears, 2);
  });

  it("supports multiple rehire cycles", () => {
    const result = computeTenure(
      {
        dateHired: "2015-01-01",
        latestAppointment: "2022-01-01",
        isArchived: false,
        employmentEvents: [
          { type: "HIRED", occurredAt: "2015-01-01" },
          { type: "TERMINATED", occurredAt: "2016-01-01" },
          { type: "HIRED", occurredAt: "2017-01-01" },
          { type: "TERMINATED", occurredAt: "2019-01-01" },
          { type: "HIRED", occurredAt: "2022-01-01" },
        ],
      },
      new Date("2025-01-01T00:00:00.000Z")
    );

    assert.equal(result.totalServiceYears, 6);
    assert.equal(result.currentAppointmentYears, 3);
  });

  it("falls back to dateHired and terminateDate when events are missing", () => {
    const result = computeTenure(
      {
        dateHired: "2019-01-01",
        latestAppointment: "",
        terminateDate: "01/01/2024",
        isArchived: true,
        employmentEvents: [],
      },
      new Date("2025-01-01T00:00:00.000Z")
    );

    assert.equal(result.totalServiceYears, 5);
    assert.equal(result.currentAppointmentYears, 5);
  });

  it("fails safe for invalid dates", () => {
    const result = computeTenure(
      {
        dateHired: "not-a-date",
        latestAppointment: "",
        terminateDate: "",
        isArchived: false,
        employmentEvents: [{ type: "HIRED", occurredAt: "bad-date" }],
      },
      new Date("2025-01-01T00:00:00.000Z")
    );

    assert.equal(result.totalServiceYears, 0);
    assert.equal(result.currentAppointmentYears, 0);
    assert.equal(result.totalService.totalDays, 0);
  });
});

