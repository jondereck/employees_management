import assert from "node:assert/strict";
import test from "node:test";

import {
  openGenioContext,
  sealGenioContext,
  type GenioContext,
} from "@/src/genio/context";

const scope = {
  departmentId: "department-a",
  userId: "user-a",
};

test("sealed Genio context opens only for the same user and department", () => {
  process.env.GENIO_CONTEXT_SECRET = "test-genio-secret";

  const context: GenioContext = {
    lastResult: {
      type: "employee_filter",
      filters: { gender: "Female" },
    },
  };

  const sealed = sealGenioContext(context, scope);

  assert.deepEqual(openGenioContext(sealed, scope), context);
  assert.deepEqual(
    openGenioContext(sealed, { ...scope, departmentId: "department-b" }),
    {}
  );
});

test("tampered Genio context is rejected", () => {
  process.env.GENIO_CONTEXT_SECRET = "test-genio-secret";

  const sealed = sealGenioContext(
    {
      lastResult: {
        type: "employee_filter",
        filters: { gender: "Male" },
      },
    },
    scope
  );

  const tampered = {
    ...sealed,
    lastResult: {
      ...sealed.lastResult,
      filters: { gender: "Female" },
    },
  };

  assert.deepEqual(openGenioContext(tampered, scope), {});
});

test("Genio context strips raw Prisma where data before signing", () => {
  process.env.GENIO_CONTEXT_SECRET = "test-genio-secret";

  const sealed = sealGenioContext(
    {
      lastResult: {
        type: "employee_filter",
        filters: {
          gender: "Female",
          where: { departmentId: "other-department" },
        },
      },
    } as unknown as GenioContext,
    scope
  );

  assert.equal(
    Object.prototype.hasOwnProperty.call(sealed.lastResult?.filters ?? {}, "where"),
    false
  );
});

