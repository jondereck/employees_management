import type { Gender, MaritalStatus, PrismaClient } from "@prisma/client";
import { createHash } from "crypto";

import prismadb from "@/lib/prismadb";
import {
  WORKFORCE_DEFAULT_INDICATORS,
  WORKFORCE_OTHERS_INDICATOR,
  getCanonicalIndicatorLabel,
  getIndicatorCanonicalKey,
  normalizeIndicatorName,
  suggestWorkforceIndicator,
  type WorkforceIndicatorSuggestion,
} from "@/lib/workforce-indicators";

export {
  WORKFORCE_DEFAULT_INDICATORS,
  WORKFORCE_OTHERS_INDICATOR,
  suggestWorkforceIndicator,
} from "@/lib/workforce-indicators";

export const WORKFORCE_ACTIVE_STATUS = "ACTIVE";
export const WORKFORCE_INACTIVE_STATUS = "INACTIVE";
export const WORKFORCE_REPORT_CACHE_VERSION = 2;

export const WORKFORCE_DIMENSIONS = [
  "employeeType",
  "gender",
  "maritalStatus",
  "eligibility",
  "office",
  "position",
  "status",
  "headStatus",
] as const;

export type WorkforceDimension = (typeof WORKFORCE_DIMENSIONS)[number];
export type WorkforcePopulationMode = "active" | "all";

export type WorkforceAiSuggestionInput = {
  employeeId: string;
  position?: string | null;
  officeName?: string | null;
  employeeTypeName?: string | null;
};

export type WorkforceSnapshotEmployee = {
  id: string;
  departmentId: string;
  officeId: string;
  employeeTypeId: string;
  eligibilityId: string;
  position: string;
  gender: Gender;
  maritalStatus: MaritalStatus | null;
  isHead: boolean;
  isArchived: boolean;
  dateHired: Date;
  terminateDate: string;
  updatedAt?: Date;
};

type PrismaLike = PrismaClient | Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

function normalizeAiIndicatorName(value: unknown) {
  if (typeof value !== "string") return null;
  const key = getIndicatorCanonicalKey(value);
  return key ?? null;
}

function normalizeAiConfidence(value: unknown): WorkforceIndicatorSuggestion["confidence"] {
  if (value === "high" || value === "medium" || value === "low") return value;
  return "low";
}

export async function suggestWorkforceIndicatorWithAiFallback(
  input: WorkforceAiSuggestionInput
): Promise<WorkforceIndicatorSuggestion> {
  const ruleSuggestion = suggestWorkforceIndicator(input);
  if (ruleSuggestion.confidence !== "low") return ruleSuggestion;

  const aiEnabled = process.env.WORKFORCE_SUGGESTION_AI_ENABLED === "true";
  const apiKey = process.env.OPENAI_API_KEY;
  if (!aiEnabled || !apiKey) return ruleSuggestion;

  try {
    const model = process.env.WORKFORCE_SUGGESTION_AI_MODEL || "gpt-4.1-mini";
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content:
              "Classify government employee roles into exactly one indicator: Clerical Services, Health, Nutrition and Population Control, IT Services, Janitorial Services, Security Services, Social Services and Social Welfare, Technical, Trade and Crafts/Laborer, Others. Return strict JSON.",
          },
          {
            role: "user",
            content: JSON.stringify({
              position: input.position ?? "",
              officeName: input.officeName ?? "",
              employeeTypeName: input.employeeTypeName ?? "",
            }),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "workforce_indicator",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                indicatorName: { type: "string" },
                confidence: { type: "string", enum: ["high", "medium", "low"] },
                reason: { type: "string" },
              },
              required: ["indicatorName", "confidence", "reason"],
            },
            strict: true,
          },
        },
      }),
    });

    if (!response.ok) return ruleSuggestion;
    const payload = await response.json();
    const text = payload?.output?.[0]?.content?.[0]?.text;
    if (typeof text !== "string") return ruleSuggestion;

    const parsed = JSON.parse(text) as {
      indicatorName?: string;
      confidence?: "high" | "medium" | "low";
      reason?: string;
    };

    const canonical = normalizeAiIndicatorName(parsed.indicatorName);
    if (!canonical) return ruleSuggestion;

    return {
      indicatorName: canonical,
      confidence: normalizeAiConfidence(parsed.confidence),
      reason: `AI_FALLBACK: ${parsed.reason || "AI classified low-confidence record."}`,
    };
  } catch {
    return ruleSuggestion;
  }
}

export async function enhanceWorkforceSuggestionsWithAi(
  employees: WorkforceAiSuggestionInput[]
) {
  const maxBatch = Math.max(
    1,
    Number.parseInt(process.env.WORKFORCE_SUGGESTION_AI_MAX_BATCH || "40", 10) || 40
  );

  const output = new Map<string, WorkforceIndicatorSuggestion>();
  for (const employee of employees.slice(0, maxBatch)) {
    output.set(employee.employeeId, await suggestWorkforceIndicatorWithAiFallback(employee));
  }

  return output;
}

export async function ensureDefaultWorkforceIndicators(departmentId: string) {
  const existing = await prismadb.workforceReportGroup.findMany({
    where: { departmentId },
    select: { id: true, name: true, sortOrder: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const existingNames = new Set(existing.map((indicator) => normalizeIndicatorName(indicator.name)));
  const existingCanonicalKeys = new Set(
    existing.map((indicator) => getIndicatorCanonicalKey(indicator.name)).filter(Boolean)
  );
  const missingDefaults = WORKFORCE_DEFAULT_INDICATORS.filter(
    (name) => !existingNames.has(normalizeIndicatorName(name)) && !existingCanonicalKeys.has(name)
  );

  if (missingDefaults.length > 0) {
    await prismadb.workforceReportGroup.createMany({
      data: missingDefaults.map((name, index) => ({
        departmentId,
        name,
        sortOrder: existing.length + index,
      })),
      skipDuplicates: true,
    });
  }

  const renamedIndicators = existing
    .map((indicator) => {
      const canonicalName = getIndicatorCanonicalKey(indicator.name);
      if (!canonicalName || canonicalName === indicator.name) return null;
      if (existingNames.has(normalizeIndicatorName(canonicalName))) return null;
      return {
        id: indicator.id,
        name: indicator.name,
        canonicalName,
      };
    })
    .filter(Boolean) as Array<{ id: string; name: string; canonicalName: string }>;

  for (const indicator of renamedIndicators) {
    await prismadb.workforceReportGroup.update({
      where: { id: indicator.id },
      data: { name: indicator.canonicalName },
    });
  }

  await cleanupDuplicateDefaultIndicators(departmentId);
}

export async function cleanupDuplicateDefaultIndicators(departmentId: string) {
  const indicators = await prismadb.workforceReportGroup.findMany({
    where: { departmentId },
    include: {
      offices: { select: { id: true, officeId: true } },
      _count: { select: { snapshots: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const byCanonical = new Map<string, typeof indicators>();
  for (const indicator of indicators) {
    const key = getIndicatorCanonicalKey(indicator.name);
    if (!key) continue;
    const list = byCanonical.get(key) ?? [];
    list.push(indicator);
    byCanonical.set(key, list);
  }

  for (const entries of byCanonical.values()) {
    if (entries.length <= 1) continue;

    const keeper =
      entries.find((entry) => entry._count.snapshots > 0) ??
      entries.find((entry) => !WORKFORCE_DEFAULT_INDICATORS.includes(entry.name as any)) ??
      entries[0];
    const duplicates = entries.filter((entry) => entry.id !== keeper.id);

    for (const duplicate of duplicates) {
      await prismadb.employeeHistorySnapshot.updateMany({
        where: { indicatorId: duplicate.id },
        data: { indicatorId: keeper.id },
      });

      for (const office of duplicate.offices) {
        await prismadb.workforceReportGroupOffice.upsert({
          where: {
            groupId_officeId: {
              groupId: keeper.id,
              officeId: office.officeId,
            },
          },
          create: {
            groupId: keeper.id,
            officeId: office.officeId,
          },
          update: {},
        });
      }

      await prismadb.workforceReportGroup.delete({
        where: { id: duplicate.id },
      });
    }
  }

  const others = await prismadb.workforceReportGroup.findFirst({
    where: {
      departmentId,
      name: WORKFORCE_OTHERS_INDICATOR,
    },
    include: {
      offices: { select: { id: true, officeId: true } },
    },
  });
  if (others) {
    const obsolete = indicators.filter((indicator) => !getIndicatorCanonicalKey(indicator.name));
    for (const indicator of obsolete) {
      await prismadb.employeeHistorySnapshot.updateMany({
        where: { indicatorId: indicator.id },
        data: { indicatorId: others.id },
      });

      for (const office of indicator.offices) {
        await prismadb.workforceReportGroupOffice.upsert({
          where: {
            groupId_officeId: {
              groupId: others.id,
              officeId: office.officeId,
            },
          },
          create: {
            groupId: others.id,
            officeId: office.officeId,
          },
          update: {},
        });
      }

      await prismadb.workforceReportGroup.delete({
        where: { id: indicator.id },
      });
    }
  }

  await invalidateWorkforceReportCache(departmentId);
}

async function resolveSuggestedWorkforceIndicatorId(
  db: PrismaLike,
  employee: Pick<WorkforceSnapshotEmployee, "departmentId" | "officeId" | "employeeTypeId" | "position">
) {
  await ensureDefaultWorkforceIndicators(employee.departmentId);

  const [office, employeeType] = await Promise.all([
    employee.officeId
      ? (db as any).offices.findUnique({
          where: { id: employee.officeId },
          select: { name: true },
        })
      : null,
    employee.employeeTypeId
      ? (db as any).employeeType.findUnique({
          where: { id: employee.employeeTypeId },
          select: { name: true },
        })
      : null,
  ]);

  const suggestion = suggestWorkforceIndicator({
    position: employee.position,
    officeName: office?.name ?? null,
    employeeTypeName: employeeType?.name ?? null,
  });

  const indicator = await (db as any).workforceReportGroup.findFirst({
    where: {
      departmentId: employee.departmentId,
      name: getCanonicalIndicatorLabel(suggestion.indicatorName),
    },
    select: { id: true },
  });

  if (indicator?.id) return indicator.id;
  return resolveWorkforceIndicatorId(employee.departmentId, null);
}

export async function resolveWorkforceIndicatorId(
  departmentId: string,
  officeId?: string | null,
  requestedIndicatorId?: string | null
) {
  await ensureDefaultWorkforceIndicators(departmentId);

  if (requestedIndicatorId) {
    const indicator = await prismadb.workforceReportGroup.findFirst({
      where: { id: requestedIndicatorId, departmentId },
      select: { id: true },
    });
    if (!indicator) {
      throw new Error("Selected indicator does not belong to this department.");
    }
    return indicator.id;
  }

  if (officeId) {
    const officeFallback = await prismadb.workforceReportGroupOffice.findFirst({
      where: {
        officeId,
        group: { departmentId },
      },
      select: { groupId: true },
      orderBy: { group: { sortOrder: "asc" } },
    });
    if (officeFallback) return officeFallback.groupId;
  }

  const others = await prismadb.workforceReportGroup.findFirst({
    where: { departmentId, name: WORKFORCE_OTHERS_INDICATOR },
    select: { id: true },
  });

  return others?.id ?? null;
}

export function buildWorkforceReportGroupHash(groupIds: string[]) {
  const sorted = [...groupIds].sort();
  return createHash("sha1").update(JSON.stringify(sorted)).digest("hex");
}

export async function invalidateWorkforceReportCache(
  departmentId: string,
  db: PrismaLike = prismadb
) {
  await (db as any).workforceReportCache.deleteMany({
    where: { departmentId },
  });
}

export async function getWorkforceReportCache(
  departmentId: string,
  year: number,
  populationMode: WorkforcePopulationMode,
  dimension: WorkforceDimension,
  selectedGroupHash: string
) {
  return (prismadb as any).workforceReportCache.findFirst({
    where: {
      departmentId,
      year,
      populationMode,
      dimension,
      selectedGroupHash,
      version: WORKFORCE_REPORT_CACHE_VERSION,
    },
    select: {
      payload: true,
      generatedAt: true,
    },
  });
}

export async function upsertWorkforceReportCache(
  departmentId: string,
  year: number,
  populationMode: WorkforcePopulationMode,
  dimension: WorkforceDimension,
  selectedGroupHash: string,
  selectedGroupIds: string[],
  payload: unknown
) {
  await (prismadb as any).workforceReportCache.upsert({
    where: {
      departmentId_year_populationMode_dimension_selectedGroupHash_version: {
        departmentId,
        year,
        populationMode,
        dimension,
        selectedGroupHash,
        version: WORKFORCE_REPORT_CACHE_VERSION,
      },
    },
    create: {
      departmentId,
      year,
      populationMode,
      dimension,
      selectedGroupHash,
      selectedGroupIds,
      version: WORKFORCE_REPORT_CACHE_VERSION,
      payload,
    },
    update: {
      selectedGroupIds,
      payload,
      generatedAt: new Date(),
    },
  });
}

export function endOfReportYear(year: number) {
  return new Date(year, 11, 31, 23, 59, 59, 999);
}

export function parseEmployeeTerminationDate(value?: string | null): Date | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;

  const slashParts = trimmed.split("/");
  if (slashParts.length === 3) {
    const [month, day, year] = slashParts.map(Number);
    if (month && day && year) {
      const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toSnapshotStatus(isArchived: boolean) {
  return isArchived ? WORKFORCE_INACTIVE_STATUS : WORKFORCE_ACTIVE_STATUS;
}

export function snapshotFieldsChanged(
  before: Pick<
    WorkforceSnapshotEmployee,
    | "officeId"
    | "employeeTypeId"
    | "eligibilityId"
    | "position"
    | "gender"
    | "maritalStatus"
    | "isHead"
    | "isArchived"
    | "terminateDate"
  >,
  after: Pick<
    WorkforceSnapshotEmployee,
    | "officeId"
    | "employeeTypeId"
    | "eligibilityId"
    | "position"
    | "gender"
    | "maritalStatus"
    | "isHead"
    | "isArchived"
    | "terminateDate"
  >
) {
  return (
    before.officeId !== after.officeId ||
    before.employeeTypeId !== after.employeeTypeId ||
    before.eligibilityId !== after.eligibilityId ||
    before.position !== after.position ||
    before.gender !== after.gender ||
    before.maritalStatus !== after.maritalStatus ||
    before.isHead !== after.isHead ||
    before.isArchived !== after.isArchived ||
    before.terminateDate !== after.terminateDate
  );
}

export async function createEmployeeHistorySnapshot(
  db: PrismaLike,
  employee: WorkforceSnapshotEmployee,
  options: {
    effectiveAt?: Date;
    status?: string;
    indicatorId?: string | null;
    source: string;
    note?: string;
  }
) {
  const status = options.status ?? toSnapshotStatus(employee.isArchived);
  const effectiveAt =
    options.effectiveAt ??
    (status === WORKFORCE_INACTIVE_STATUS
      ? parseEmployeeTerminationDate(employee.terminateDate) ?? employee.updatedAt ?? new Date()
      : employee.dateHired ?? new Date());
  const previousIndicator =
    options.indicatorId === undefined
      ? await db.employeeHistorySnapshot.findFirst({
          where: {
            employeeId: employee.id,
            indicatorId: { not: null },
          },
          select: { indicatorId: true },
          orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
        })
      : null;
  const indicatorId =
    options.indicatorId ??
    (await resolveSuggestedWorkforceIndicatorId(db, employee)) ??
    previousIndicator?.indicatorId ??
    (await resolveWorkforceIndicatorId(employee.departmentId, null));

  const snapshot = await db.employeeHistorySnapshot.create({
    data: {
      departmentId: employee.departmentId,
      employeeId: employee.id,
      effectiveAt,
      officeId: employee.officeId || null,
      employeeTypeId: employee.employeeTypeId || null,
      eligibilityId: employee.eligibilityId || null,
      position: employee.position ?? "",
      gender: employee.gender,
      maritalStatus: employee.maritalStatus ?? null,
      isHead: Boolean(employee.isHead),
      status,
      indicatorId,
      source: options.source,
      note: options.note ?? null,
    },
  });
  await invalidateWorkforceReportCache(employee.departmentId, db);
  return snapshot;
}

export async function backfillWorkforceHistorySnapshots(departmentId: string) {
  await ensureDefaultWorkforceIndicators(departmentId);

  const indicators = await prismadb.workforceReportGroup.findMany({
    where: { departmentId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const indicatorIdByName = new Map(indicators.map((indicator) => [indicator.name, indicator.id]));

  const employees = await prismadb.employee.findMany({
    where: { departmentId },
    select: {
      id: true,
      departmentId: true,
      officeId: true,
      employeeTypeId: true,
      eligibilityId: true,
      position: true,
      gender: true,
      maritalStatus: true,
      isHead: true,
      isArchived: true,
      dateHired: true,
      terminateDate: true,
      updatedAt: true,
      offices: {
        select: { name: true },
      },
      employeeType: {
        select: { name: true },
      },
      historySnapshots: {
        where: { source: "BACKFILL" },
        select: {
          status: true,
        },
      },
    },
  });

  const snapshots = employees.flatMap((employee) => {
    const suggestion = suggestWorkforceIndicator({
      position: employee.position,
      officeName: employee.offices?.name ?? null,
      employeeTypeName: employee.employeeType?.name ?? null,
    });
    const baseSnapshot = {
      departmentId: employee.departmentId,
      employeeId: employee.id,
      effectiveAt: employee.dateHired,
      officeId: employee.officeId || null,
      employeeTypeId: employee.employeeTypeId || null,
      eligibilityId: employee.eligibilityId || null,
      position: employee.position ?? "",
      gender: employee.gender,
      maritalStatus: employee.maritalStatus ?? null,
      isHead: Boolean(employee.isHead),
      status: WORKFORCE_ACTIVE_STATUS,
      indicatorId: indicatorIdByName.get(getCanonicalIndicatorLabel(suggestion.indicatorName)) ?? indicatorIdByName.get(WORKFORCE_OTHERS_INDICATOR) ?? null,
      source: "BACKFILL",
      note: "Baseline snapshot generated from current employee record and date hired.",
    };

    const existingBackfillStatuses = new Set(employee.historySnapshots.map((snapshot) => snapshot.status));
    const missingSnapshots = existingBackfillStatuses.has(WORKFORCE_ACTIVE_STATUS) ? [] : [baseSnapshot];
    const termination = parseEmployeeTerminationDate(employee.terminateDate);

    if (!employee.isArchived && !termination) {
      return missingSnapshots;
    }

    if (!existingBackfillStatuses.has(WORKFORCE_INACTIVE_STATUS)) {
      missingSnapshots.push({
        ...baseSnapshot,
        effectiveAt: termination ?? employee.updatedAt,
        status: WORKFORCE_INACTIVE_STATUS,
        note: "Inactive snapshot generated from termination/archive data.",
      });
    }

    return missingSnapshots;
  });

  let created = 0;
  const batchSize = 500;

  for (let index = 0; index < snapshots.length; index += batchSize) {
    const batch = snapshots.slice(index, index + batchSize);
    if (batch.length === 0) continue;

    const result = await prismadb.employeeHistorySnapshot.createMany({
      data: batch,
    });
    created += result.count;
  }

  let updatedMissingIndicators = 0;
  const othersIndicatorId = indicatorIdByName.get(WORKFORCE_OTHERS_INDICATOR) ?? null;
  if (othersIndicatorId) {
    const result = await prismadb.employeeHistorySnapshot.updateMany({
      where: {
        departmentId,
        indicatorId: null,
      },
      data: { indicatorId: othersIndicatorId },
    });
    updatedMissingIndicators += result.count;
  }

  await invalidateWorkforceReportCache(departmentId);

  return {
    employeesChecked: employees.length,
    snapshotsCreated: created,
    snapshotsUpdated: updatedMissingIndicators,
  };
}
