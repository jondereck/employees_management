import assert from "node:assert/strict";
import test from "node:test";

import {
  WORKFORCE_CHANGED_EVENT,
  isWorkforceChangedPayload,
  triggerWorkforceChangedBestEffort,
  workforceChannel,
} from "../lib/workforce-realtime-contract";
import {
  isOfficeWorkforceDetailsKey,
  officeWorkforceDetailsKey,
  officeWorkforceSummaryKey,
} from "../lib/office-workforce-swr";

test("constructs the exact department workforce channel and event", () => {
  assert.equal(workforceChannel("department-1"), "dept-department-1-workforce");
  assert.equal(WORKFORCE_CHANGED_EVENT, "workforce:changed");
});

test("accepts only non-sensitive workforce invalidation payloads", () => {
  assert.equal(
    isWorkforceChangedPayload({ scope: "employee", action: "updated" }),
    true
  );
  assert.equal(
    isWorkforceChangedPayload({
      scope: "plantilla",
      action: "linked",
      employeeId: "secret",
    }),
    false
  );
  assert.equal(
    isWorkforceChangedPayload({ scope: "employee", action: "renamed" }),
    false
  );
  assert.equal(isWorkforceChangedPayload(null), false);
});

test("best-effort publishing swallows trigger failures", async () => {
  let calls = 0;
  await assert.doesNotReject(() =>
    triggerWorkforceChangedBestEffort(
      async () => {
        calls += 1;
        throw new Error("Pusher unavailable");
      },
      "department-1",
      { scope: "office", action: "updated" },
      () => {}
    )
  );
  assert.equal(calls, 1);
});

test("constructs stable summary and detail SWR keys", () => {
  assert.equal(
    officeWorkforceSummaryKey("department-1"),
    "/api/department-1/offices/workforce-summary"
  );
  assert.equal(
    officeWorkforceDetailsKey("department-1", "office-1", "vacant"),
    "/api/department-1/offices/office-1/workforce-details?view=vacant"
  );
});

test("matches only loaded workforce detail keys for the department", () => {
  const key = officeWorkforceDetailsKey(
    "department-1",
    "office-1",
    "assigned-here-plantilla-elsewhere"
  );

  assert.equal(isOfficeWorkforceDetailsKey(key, "department-1"), true);
  assert.equal(isOfficeWorkforceDetailsKey(key, "department-2"), false);
  assert.equal(
    isOfficeWorkforceDetailsKey(
      "/api/department-1/offices/workforce-summary",
      "department-1"
    ),
    false
  );
  assert.equal(isOfficeWorkforceDetailsKey(["not", "a", "string"], "department-1"), false);
  assert.equal(
    isOfficeWorkforceDetailsKey(
      "/api/department-1/offices/office-1/workforce-details?view=invalid",
      "department-1"
    ),
    false
  );
  assert.equal(
    isOfficeWorkforceDetailsKey(
      "/api/department-1/offices/office-1/workforce-details?view=vacant&extra=1",
      "department-1"
    ),
    false
  );
  assert.equal(
    isOfficeWorkforceDetailsKey(
      "/prefix/api/department-1/offices/office-1/workforce-details?view=vacant",
      "department-1"
    ),
    false
  );
  assert.equal(
    isOfficeWorkforceDetailsKey(
      "/api/department-1/offices/nested/office/workforce-details?view=vacant",
      "department-1"
    ),
    false
  );
});
