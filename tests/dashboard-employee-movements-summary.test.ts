import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDashboardEmployeeMovementsSummary,
  getManilaMonthUtcRange,
  type DashboardMovementInput,
} from "../lib/dashboard-employee-movements";

function movement(
  overrides: Partial<DashboardMovementInput> = {},
): DashboardMovementInput {
  return {
    id: "movement-1",
    employeeId: "employee-1",
    name: "Test Employee",
    office: "Main Office",
    position: "Staff",
    occurredAt: "2026-07-15T04:00:00.000Z",
    ...overrides,
  };
}

test("getManilaMonthUtcRange returns July 2026 Manila boundaries", () => {
  const range = getManilaMonthUtcRange(new Date("2026-07-21T08:00:00.000Z"));

  assert.equal(range.start.toISOString(), "2026-06-30T16:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-07-31T16:00:00.000Z");
  assert.equal(range.monthLabel, "July 2026");
});

test("getManilaMonthUtcRange handles December-to-January rollover", () => {
  const range = getManilaMonthUtcRange(new Date("2026-01-15T08:00:00.000Z"));

  assert.equal(range.start.toISOString(), "2025-12-31T16:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-01-31T16:00:00.000Z");
  assert.equal(range.monthLabel, "January 2026");
});

test("buildDashboardEmployeeMovementsSummary counts each category and total", () => {
  const summary = buildDashboardEmployeeMovementsSummary(
    {
      hired: [movement({ id: "h1" })],
      promoted: [movement({ id: "p1", occurredAt: "2026-07-10T00:00:00.000Z" })],
      separated: [
        movement({ id: "s1", occurredAt: "2026-07-20T00:00:00.000Z" }),
      ],
    },
    "department-1",
    new Date("2026-07-21T08:00:00.000Z"),
  );

  assert.equal(summary.hired.count, 1);
  assert.equal(summary.promoted.count, 1);
  assert.equal(summary.separated.count, 1);
  assert.equal(summary.total, 3);
  assert.equal(summary.monthLabel, "July 2026");
});

test("allows the same employee in multiple categories", () => {
  const summary = buildDashboardEmployeeMovementsSummary(
    {
      hired: [movement({ id: "h1", employeeId: "employee-1" })],
      promoted: [movement({ id: "p1", employeeId: "employee-1" })],
      separated: [movement({ id: "s1", employeeId: "employee-1" })],
    },
    "department-1",
    new Date("2026-07-21T08:00:00.000Z"),
  );

  assert.equal(summary.total, 3);
  assert.equal(summary.hired.employees[0].employeeId, "employee-1");
  assert.equal(summary.promoted.employees[0].employeeId, "employee-1");
  assert.equal(summary.separated.employees[0].employeeId, "employee-1");
});

test("keeps duplicate same-category events as separate movements", () => {
  const summary = buildDashboardEmployeeMovementsSummary(
    {
      hired: [],
      promoted: [
        movement({ id: "promotion-1", employeeId: "employee-1" }),
        movement({ id: "promotion-2", employeeId: "employee-1" }),
      ],
      separated: [],
    },
    "department-1",
    new Date("2026-07-21T08:00:00.000Z"),
  );

  assert.equal(summary.promoted.count, 2);
  assert.deepEqual(
    summary.promoted.employees.map((item) => item.id),
    ["promotion-1", "promotion-2"],
  );
});

test("includes a movement at the exact Manila month start boundary", () => {
  const summary = buildDashboardEmployeeMovementsSummary(
    {
      hired: [
        movement({
          id: "month-start",
          occurredAt: "2026-06-30T16:00:00.000Z",
        }),
      ],
      promoted: [],
      separated: [],
    },
    "department-1",
    new Date("2026-07-21T08:00:00.000Z"),
  );

  assert.equal(summary.hired.count, 1);
  assert.equal(summary.hired.employees[0].id, "month-start");
});

test("excludes rows outside the Manila month, deleted events, and invalid dates", () => {
  const summary = buildDashboardEmployeeMovementsSummary(
    {
      hired: [
        movement({ id: "included", occurredAt: "2026-07-15T04:00:00.000Z" }),
        movement({ id: "previous", occurredAt: "2026-06-30T15:59:59.000Z" }),
        movement({ id: "invalid", occurredAt: "not-a-date" }),
      ],
      promoted: [
        movement({
          id: "deleted",
          deletedAt: "2026-07-10T00:00:00.000Z",
        }),
        movement({ id: "kept", occurredAt: "2026-07-05T00:00:00.000Z" }),
      ],
      separated: [
        movement({ id: "next-month", occurredAt: "2026-07-31T16:00:00.000Z" }),
      ],
    },
    "department-1",
    new Date("2026-07-21T08:00:00.000Z"),
  );

  assert.equal(summary.hired.count, 1);
  assert.equal(summary.hired.employees[0].id, "included");
  assert.equal(summary.promoted.count, 1);
  assert.equal(summary.promoted.employees[0].id, "kept");
  assert.equal(summary.separated.count, 0);
  assert.equal(summary.total, 2);
});

test("sorts each category by date descending then name", () => {
  const summary = buildDashboardEmployeeMovementsSummary(
    {
      hired: [
        movement({
          id: "older",
          name: "Older Employee",
          occurredAt: "2026-07-01T00:00:00.000Z",
        }),
        movement({
          id: "z",
          name: "Zulu Employee",
          occurredAt: "2026-07-20T00:00:00.000Z",
        }),
        movement({
          id: "a",
          name: "Alpha Employee",
          occurredAt: "2026-07-20T00:00:00.000Z",
        }),
      ],
      promoted: [],
      separated: [],
    },
    "department-1",
    new Date("2026-07-21T08:00:00.000Z"),
  );

  assert.deepEqual(summary.hired.employees.map((item) => item.id), [
    "a",
    "z",
    "older",
  ]);
});

test("supplies office and position fallbacks, href, and Manila date labels", () => {
  const summary = buildDashboardEmployeeMovementsSummary(
    {
      hired: [
        movement({
          id: "fallback",
          employeeId: "employee-42",
          office: " ",
          position: "",
          occurredAt: "2026-07-10T00:00:00.000Z",
        }),
      ],
      promoted: [],
      separated: [],
    },
    "department-1",
    new Date("2026-07-21T08:00:00.000Z"),
  );

  const row = summary.hired.employees[0];
  assert.equal(row.office, "Unassigned Office");
  assert.equal(row.position, "Position not specified");
  assert.equal(row.dateLabel, "Jul 10, 2026");
  assert.equal(row.href, "/department-1/employees/employee-42");
});

test("parses JSON event details preferring description then title", () => {
  const summary = buildDashboardEmployeeMovementsSummary(
    {
      hired: [],
      promoted: [
        movement({
          id: "desc",
          details: JSON.stringify({
            title: "Promotion Title",
            description: "Promotion Description",
          }),
        }),
        movement({
          id: "title-only",
          details: JSON.stringify({ title: "Title Only" }),
        }),
      ],
      separated: [],
    },
    "department-1",
    new Date("2026-07-21T08:00:00.000Z"),
  );

  assert.equal(summary.promoted.employees[0].details, "Promotion Description");
  assert.equal(summary.promoted.employees[1].details, "Title Only");
});

test("preserves a nonblank JSON string primitive detail", () => {
  const summary = buildDashboardEmployeeMovementsSummary(
    {
      hired: [],
      promoted: [
        movement({ id: "json-string", details: JSON.stringify("Note") }),
      ],
      separated: [],
    },
    "department-1",
    new Date("2026-07-21T08:00:00.000Z"),
  );

  assert.equal(summary.promoted.employees[0].details, "Note");
});

test("omits details from hired rows", () => {
  const summary = buildDashboardEmployeeMovementsSummary(
    {
      hired: [
        movement({
          id: "hire-with-details",
          details: JSON.stringify({ description: "Internal note" }),
        }),
      ],
      promoted: [],
      separated: [],
    },
    "department-1",
    new Date("2026-07-21T08:00:00.000Z"),
  );

  assert.equal(summary.hired.employees[0].details, undefined);
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      summary.hired.employees[0],
      "details",
    ),
    false,
  );
});

test("retains nonblank plain and malformed JSON details", () => {
  const summary = buildDashboardEmployeeMovementsSummary(
    {
      hired: [],
      promoted: [
        movement({ id: "plain", details: "Plain text details" }),
        movement({ id: "malformed", details: "{not valid json" }),
      ],
      separated: [],
    },
    "department-1",
    new Date("2026-07-21T08:00:00.000Z"),
  );

  assert.equal(summary.promoted.employees[0].details, "Plain text details");
  assert.equal(summary.promoted.employees[1].details, "{not valid json");
});

test("omits blank or whitespace-only details", () => {
  const summary = buildDashboardEmployeeMovementsSummary(
    {
      hired: [],
      promoted: [
        movement({ id: "blank", details: "   " }),
        movement({
          id: "empty-json",
          details: JSON.stringify({ title: " ", description: "" }),
        }),
      ],
      separated: [],
    },
    "department-1",
    new Date("2026-07-21T08:00:00.000Z"),
  );

  assert.equal(summary.promoted.employees[0].details, undefined);
  assert.equal(summary.promoted.employees[1].details, undefined);
});
