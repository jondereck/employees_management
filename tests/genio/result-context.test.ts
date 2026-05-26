import assert from "node:assert/strict";
import test from "node:test";

import { buildContextFromStoredGenioResult } from "@/src/genio/resultContext";

test("buildContextFromStoredGenioResult restores normalized lastResult", () => {
  const restored = buildContextFromStoredGenioResult({
    id: "ctx-1",
    departmentId: "d1",
    userId: "u1",
    question: "how many female",
    toolName: "count_employees",
    toolArgsJson: { gender: "Female" },
    resultKind: "employee_filter",
    rowIdsJson: ["emp1", "emp2"],
    aggregateJson: { officeIds: ["off1"], label: "Female employees" },
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    languageHint: null,
    localeHint: null,
    recencyScore: 1,
  } as never);

  assert.equal(restored?.resultContextId, "ctx-1");
  assert.equal(restored?.lastResult?.type, "employee_filter");
  assert.deepEqual(restored?.lastResult?.employeeIds, ["emp1", "emp2"]);
});
