import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";

import prismadb from "../lib/prismadb";
import {
  WORKFORCE_DEFAULT_INDICATORS,
  createEmployeeHistorySnapshot,
  suggestWorkforceIndicator,
} from "../lib/workforce-history";

test("uses the fixed canonical workforce indicator labels", () => {
  assert.deepEqual(WORKFORCE_DEFAULT_INDICATORS, [
    "Clerical Services",
    "Health, Nutrition and Population Control",
    "IT Services",
    "Janitorial Services",
    "Security Services",
    "Social Services and Social Welfare",
    "Technical",
    "Trade and Crafts/Laborer",
    "Others",
  ]);
});

test("maps teacher and education roles into social services and social welfare", () => {
  const suggestion = suggestWorkforceIndicator({
    position: "Teacher I",
    officeName: "Day Care Center",
    employeeTypeName: "Permanent",
  });

  assert.equal(suggestion.indicatorName, "Social Services and Social Welfare");
});

test("maps trade roles into trade and crafts/laborer", () => {
  const suggestion = suggestWorkforceIndicator({
    position: "Driver II",
    officeName: "Engineering Office",
    employeeTypeName: "Casual",
  });

  assert.equal(suggestion.indicatorName, "Trade and Crafts/Laborer");
});

test("maps health roles into health, nutrition and population control", () => {
  const suggestion = suggestWorkforceIndicator({
    position: "Nurse II",
    officeName: "Rural Health Unit",
    employeeTypeName: "Permanent",
  });

  assert.equal(suggestion.indicatorName, "Health, Nutrition and Population Control");
});

test("falls back to others when no strong keyword matches", () => {
  const suggestion = suggestWorkforceIndicator({
    position: "Protocol Officer",
    officeName: "Mayor's Office",
    employeeTypeName: "Contract of Service",
  });

  assert.equal(suggestion.indicatorName, "Others");
  assert.equal(suggestion.confidence, "low");
});

test("uses the provided transaction for snapshot indicator initialization and cache writes", async () => {
  const calls: string[] = [];
  let groupFindManyCalls = 0;
  const transaction = {
    workforceReportGroup: {
      findMany: async () => {
        calls.push("group.findMany");
        groupFindManyCalls += 1;
        return [];
      },
      createMany: async () => {
        calls.push("group.createMany");
        return { count: WORKFORCE_DEFAULT_INDICATORS.length };
      },
      update: async () => {
        calls.push("group.update");
        return {};
      },
      findFirst: async (args: { select?: { id?: boolean } }) => {
        calls.push("group.findFirst");
        return args.select?.id ? { id: "indicator-1" } : null;
      },
      delete: async () => {
        calls.push("group.delete");
        return {};
      },
    },
    workforceReportGroupOffice: {
      upsert: async () => {
        calls.push("groupOffice.upsert");
        return {};
      },
    },
    offices: {
      findUnique: async () => ({ name: "Engineering Office" }),
    },
    employeeType: {
      findUnique: async () => ({ name: "Permanent" }),
    },
    employeeHistorySnapshot: {
      findFirst: async () => null,
      updateMany: async () => {
        calls.push("snapshot.updateMany");
        return { count: 0 };
      },
      create: async () => {
        calls.push("snapshot.create");
        return { id: "snapshot-1" };
      },
    },
    workforceReportCache: {
      deleteMany: async () => {
        calls.push("cache.deleteMany");
        return { count: 0 };
      },
    },
  } as unknown as Prisma.TransactionClient;

  const globalGroup = prismadb.workforceReportGroup as unknown as {
    findMany: typeof prismadb.workforceReportGroup.findMany;
  };
  const originalGlobalFindMany = globalGroup.findMany;
  globalGroup.findMany = (async () => {
    throw new Error("global Prisma client used");
  }) as typeof globalGroup.findMany;

  try {
    await createEmployeeHistorySnapshot(
      transaction,
      {
        id: "employee-1",
        departmentId: "department-1",
        officeId: "office-1",
        employeeTypeId: "type-1",
        eligibilityId: "eligibility-1",
        position: "Engineer I",
        gender: "Male",
        maritalStatus: null,
        isHead: false,
        isArchived: false,
        dateHired: new Date("2020-01-01T00:00:00.000Z"),
        terminateDate: "",
      },
      { source: "TEST" }
    );
  } finally {
    globalGroup.findMany = originalGlobalFindMany;
  }

  assert.ok(groupFindManyCalls >= 2);
  assert.ok(calls.includes("group.createMany"));
  assert.ok(calls.includes("snapshot.create"));
  assert.ok(calls.includes("cache.deleteMany"));
});
