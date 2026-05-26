import { GenioResultContext as StoredGenioResultContext, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  genioLastResultSchema,
  type GenioContext,
} from "./context";
import type { GenioResultMetadata } from "./formatter";
import type { GenioToolResult } from "./tools";

type SaveGenioResultContextInput = {
  departmentId: string;
  userId: string;
  question?: string;
  languageHint?: string;
  localeHint?: string;
  result: GenioToolResult;
};

const RESULT_CONTEXT_TTL_HOURS = 24 * 7;
const RESULT_CONTEXT_MAX_ROWS_PER_USER = 120;

export async function saveGenioResultContext({
  departmentId,
  userId,
  question,
  languageHint,
  localeHint,
  result,
}: SaveGenioResultContextInput): Promise<GenioContext | null> {
  if (result.kind !== "text") return null;

  const metadata = result.meta?.metadata as GenioResultMetadata | undefined;
  const lastResult = result.context.lastResult;
  if (!metadata && !lastResult) return null;

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + RESULT_CONTEXT_TTL_HOURS);

  const saved = await (prisma.genioResultContext as any).create({
    data: {
      departmentId,
      userId,
      question,
      languageHint,
      localeHint,
      recencyScore: 1,
      toolName: metadata?.tool ?? lastResult?.type ?? "unknown",
      toolArgsJson: toJson(metadata?.filters ?? lastResult?.filters ?? {}),
      resultKind: lastResult?.type ?? metadata?.tool ?? "summary",
      rowIdsJson: toNullableJson(lastResult?.employeeIds),
      aggregateJson: toNullableJson({
        metadata,
        officeIds: lastResult?.officeIds,
        label: lastResult?.label,
      }),
      expiresAt,
    },
    select: { id: true },
  });

  await trimOldContexts({ departmentId, userId }).catch((error) => {
    console.warn("[GENIO_CONTEXT_TRIM]", error);
  });

  return {
    ...result.context,
    resultContextId: saved.id,
  };
}

export async function loadGenioResultContext({
  id,
  departmentId,
  userId,
}: {
  id?: string;
  departmentId: string;
  userId: string;
}) {
  if (!id) return null;
  return (prisma.genioResultContext as any).findFirst({
    where: {
      id,
      departmentId,
      userId,
      expiresAt: { gt: new Date() },
    },
  });
}

export async function loadRecentGenioResultContext({
  departmentId,
  userId,
}: {
  departmentId: string;
  userId: string;
}) {
  return (prisma.genioResultContext as any).findFirst({
    where: {
      departmentId,
      userId,
      expiresAt: { gt: new Date() },
    },
    orderBy: [{ recencyScore: "desc" }, { createdAt: "desc" }],
  });
}

export function buildContextFromStoredGenioResult(
  stored: StoredGenioResultContext | null
): GenioContext | null {
  if (!stored) return null;

  const aggregate = asRecord(stored.aggregateJson);
  const candidate = {
    type: stored.resultKind,
    filters: asRecord(stored.toolArgsJson) ?? undefined,
    employeeIds: asStringArray(stored.rowIdsJson),
    officeIds: asStringArray(aggregate?.officeIds),
    label: typeof aggregate?.label === "string" ? aggregate.label : undefined,
  };
  const parsed = genioLastResultSchema.safeParse(candidate);

  return {
    resultContextId: stored.id,
    ...(parsed.success ? { lastResult: parsed.data } : {}),
  };
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

function toNullableJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return toJson(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const values = value.filter((item): item is string => typeof item === "string");
  return values.length ? values : undefined;
}

async function trimOldContexts({
  departmentId,
  userId,
}: {
  departmentId: string;
  userId: string;
}) {
  const rows = await (prisma.genioResultContext as any).findMany({
    where: { departmentId, userId },
    select: { id: true },
    orderBy: { createdAt: "desc" },
    skip: RESULT_CONTEXT_MAX_ROWS_PER_USER,
  });
  if (!rows.length) return;
  await (prisma.genioResultContext as any).deleteMany({
    where: {
      id: { in: rows.map((row: { id: string }) => row.id) },
    },
  });
}
