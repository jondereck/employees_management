import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("actions/get-dashboard-summary.ts", "utf8");

function extractHiredFindManyBlock(): string {
  const rangeMarker =
    "dateHired: { gte: movementRange.start, lt: movementRange.end }";
  const rangeIndex = source.indexOf(rangeMarker);
  assert.ok(rangeIndex >= 0, "expected hired dateHired movement range filter");

  const blockStart = source.lastIndexOf(
    "prismadb.employee.findMany({",
    rangeIndex,
  );
  assert.ok(blockStart >= 0, "expected hired employee findMany block");

  const blockEnd = source.indexOf(
    "prismadb.employmentEvent.findMany({",
    rangeIndex,
  );
  assert.ok(
    blockEnd > blockStart,
    "expected employmentEvent query after hired query",
  );

  return source.slice(blockStart, blockEnd);
}

function extractEmploymentEventFindManyBlock(): string {
  const blockStart = source.indexOf("prismadb.employmentEvent.findMany({");
  assert.ok(blockStart >= 0, "expected employmentEvent findMany block");

  const blockEnd = source.indexOf("}),\n  ]);", blockStart);
  assert.ok(blockEnd >= 0, "expected end of Promise.all after event query");

  return source.slice(blockStart, blockEnd + "}),".length);
}

function extractMovementTimingSetup(): string {
  const match = source.match(
    /const movementNow = new Date\(\);[\s\S]*?const movementRange = getManilaMonthUtcRange\(movementNow\);/,
  );
  assert.ok(match, "expected movementNow and movementRange setup");
  return match[0];
}

function extractEmployeeMovementsBuilderBlock(): string {
  const match = source.match(
    /const employeeMovements = buildDashboardEmployeeMovementsSummary\([\s\S]*?\n  \);/,
  );
  assert.ok(match, "expected buildDashboardEmployeeMovementsSummary call");
  return match[0];
}

test("hired query filters department and dateHired range without isArchived", () => {
  const hiredBlock = extractHiredFindManyBlock();

  assert.match(hiredBlock, /where:\s*\{\s*departmentId,/);
  assert.match(
    hiredBlock,
    /dateHired:\s*\{\s*gte:\s*movementRange\.start,\s*lt:\s*movementRange\.end\s*\}/,
  );
  assert.doesNotMatch(hiredBlock, /isArchived/);
});

test("employment event query filters promoted and terminated events in range", () => {
  const eventBlock = extractEmploymentEventFindManyBlock();

  assert.match(eventBlock, /type:\s*\{\s*in:\s*\["PROMOTED",\s*"TERMINATED"\]\s*\}/);
  assert.match(eventBlock, /deletedAt:\s*null/);
  assert.match(
    eventBlock,
    /occurredAt:\s*\{\s*gte:\s*movementRange\.start,\s*lt:\s*movementRange\.end\s*\}/,
  );
  assert.match(eventBlock, /employee:\s*\{\s*departmentId\s*\}/);
});

test("uses the same movementNow for range creation and summary builder", () => {
  const timingBlock = extractMovementTimingSetup();
  const builderBlock = extractEmployeeMovementsBuilderBlock();

  assert.match(timingBlock, /const movementNow = new Date\(\);/);
  assert.match(timingBlock, /getManilaMonthUtcRange\(movementNow\)/);
  assert.match(builderBlock, /buildDashboardEmployeeMovementsSummary\([\s\S]*movementNow,\s*\)/);
  assert.doesNotMatch(builderBlock, /buildDashboardEmployeeMovementsSummary\([\s\S]*new Date\(\)/);
});
