import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";

import {
  normalizeEmployeeMutationIds,
  runEmployeeMutationTransaction,
} from "../lib/employee-mutations";

test("normalizes and deduplicates employee mutation IDs", () => {
  assert.deepEqual(
    normalizeEmployeeMutationIds([" employee-1 ", "employee-2", "employee-1"]),
    ["employee-1", "employee-2"]
  );
});

test("rejects missing, empty, or non-string employee mutation IDs", () => {
  assert.equal(normalizeEmployeeMutationIds(undefined), null);
  assert.equal(normalizeEmployeeMutationIds([]), null);
  assert.equal(normalizeEmployeeMutationIds([""]), null);
  assert.equal(normalizeEmployeeMutationIds(["employee-1", 2]), null);
});

test("rolls back the employee mutation and skips publish when bookkeeping fails", async () => {
  const persisted: string[] = [];
  let published = false;

  await assert.rejects(
    runEmployeeMutationTransaction({
      transaction: async (mutation) => {
        const staged: string[] = [];
        try {
          const result = await mutation({
            staged,
          } as unknown as Prisma.TransactionClient);
          persisted.push(...staged);
          return result;
        } catch (error) {
          throw error;
        }
      },
      mutation: async (tx) => {
        (tx as unknown as { staged: string[] }).staged.push("employee update");
        throw new Error("bookkeeping failed");
      },
      publish: async () => {
        published = true;
      },
    }),
    /bookkeeping failed/
  );

  assert.deepEqual(persisted, []);
  assert.equal(published, false);
});

test("publishes only after the employee transaction commits", async () => {
  const order: string[] = [];

  const result = await runEmployeeMutationTransaction({
    transaction: async (mutation) => {
      order.push("transaction:start");
      const value = await mutation({} as Prisma.TransactionClient);
      order.push("transaction:commit");
      return value;
    },
    mutation: async () => {
      order.push("employee-and-bookkeeping");
      return { id: "employee-1" };
    },
    publish: async () => {
      order.push("publish");
    },
  });

  assert.deepEqual(result, { id: "employee-1" });
  assert.deepEqual(order, [
    "transaction:start",
    "employee-and-bookkeeping",
    "transaction:commit",
    "publish",
  ]);
});
