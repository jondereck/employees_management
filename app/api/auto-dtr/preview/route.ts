import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { firstEmployeeNoToken } from "@/lib/employeeNo";
import type { DTRPreview, DTRPreviewRow, DTRSlot, ManualExclusion, ManualExclusionReason } from "@/types/autoDtr";
import {
  mergeParsedWorkbooks,
  parseBioAttendance,
  type ParsedPerDayRow,
} from "@/utils/parseBioAttendance";
import { normalizeBiometricToken } from "@/utils/biometricsShared";

const MANUAL_REASON_LABELS: Record<ManualExclusionReason, string> = {
  SUSPENSION: "Suspension",
  OFFICE_CLOSURE: "Office closure",
  CALAMITY: "Calamity",
  TRAINING: "Training",
  LEAVE: "Leave",
  LOCAL_HOLIDAY: "Local holiday",
  OTHER: "Other",
};

const UNKNOWN_EMPLOYEE_NAME = "(Unmatched)";
const UNKNOWN_OFFICE = "(Unknown)";
const UNASSIGNED_OFFICE = "(Unassigned)";

const manualExclusionSchema = z.object({
  id: z.string(),
  dates: z.array(z.string()),
  scope: z.enum(["all", "offices", "employees"]),
  officeIds: z.array(z.string()).optional(),
  employeeIds: z.array(z.string()).optional(),
  reason: z.enum(["SUSPENSION", "OFFICE_CLOSURE", "CALAMITY", "TRAINING", "LEAVE", "LOCAL_HOLIDAY", "OTHER"]),
  note: z.string().optional(),
});

const metadataSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  splitTime: z.string(),
  rounding: z.enum(["none", "5", "10"]),
  manualExclusions: z.array(manualExclusionSchema),
  employeeIds: z.array(z.string()),
  officeIds: z.array(z.string()),
  departmentId: z.string().optional(),
});

type IdentityRecord = {
  employeeId: string | null;
  employeeNo: string | null;
  employeeName: string;
  officeId: string | null;
  officeName: string | null;
  status: "matched" | "unmatched" | "ambiguous";
};

type RowEntry = {
  row: DTRPreviewRow;
  identity: IdentityRecord;
};

type EmployeeCandidate = {
  id: string;
  employeeNo: string | null;
  isHead: boolean;
  firstName: string;
  lastName: string;
  middleName: string | null;
  suffix: string | null;
  updatedAt: Date;
  office: { id: string; name: string } | null;
};

const identityMapModel = (prisma as typeof prisma & {
  biometricsIdentityMap?: typeof prisma.biometricsIdentityMap;
}).biometricsIdentityMap;

const normalizeEmployeeNo = (value: string | null | undefined): string | null => {
  const token = firstEmployeeNoToken(value ?? null);
  if (token) return token;
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const formatEmployeeName = (candidate: {
  lastName: string | null;
  firstName: string | null;
  middleName: string | null;
  suffix: string | null;
  employeeNo?: string | null;
}): string => {
  const last = candidate.lastName?.trim();
  const first = candidate.firstName?.trim();
  const middle = candidate.middleName?.trim();
  const suffix = candidate.suffix?.trim();

  const middleInitial = middle
    ? middle
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => `${part.charAt(0).toUpperCase()}.`)
        .join(" ")
    : "";

  const pieces = [last, ", ", first];
  if (middleInitial) pieces.push(" ", middleInitial);
  if (suffix) pieces.push(" ", suffix);
  const formatted = pieces.filter(Boolean).join("");
  return formatted || candidate.employeeNo || UNKNOWN_EMPLOYEE_NAME;
};

const convertTimesToSlot = (times: string[]): DTRSlot => {
  const slot: DTRSlot = {};
  const fields: Array<keyof Pick<DTRSlot, "amIn" | "amOut" | "pmIn" | "pmOut">> = ["amIn", "amOut", "pmIn", "pmOut"];
  const extras: string[] = [];

  times.forEach((time, index) => {
    const target = fields[index];
    if (target) {
      slot[target] = time;
    } else {
      extras.push(time);
    }
  });

  if (extras.length) {
    slot.remark = `Extra: ${extras.join(", ")}`;
  }

  return slot;
};

const exclusionLabel = (entry: ManualExclusion): string => {
  const note = entry.note?.trim();
  if (note && note.length) return note;
  return MANUAL_REASON_LABELS[entry.reason];
};

const matchesExclusion = (exclusion: ManualExclusion, identity: IdentityRecord): boolean => {
  switch (exclusion.scope) {
    case "all":
      return true;
    case "employees":
      return Boolean(identity.employeeId && exclusion.employeeIds?.includes(identity.employeeId));
    case "offices":
      return Boolean(identity.officeId && exclusion.officeIds?.includes(identity.officeId));
    default:
      return false;
  }
};

const passesFilters = (
  identity: IdentityRecord,
  employeeIds: string[],
  officeIds: string[]
): boolean => {
  if (employeeIds.length) {
    if (!identity.employeeId) return false;
    if (!employeeIds.includes(identity.employeeId)) return false;
  }
  if (officeIds.length) {
    if (!identity.officeId) return false;
    if (!officeIds.includes(identity.officeId)) return false;
  }
  return true;
};

const deriveResolutionToken = (row: ParsedPerDayRow): string | null => {
  const candidates = [
    row.employeeToken,
    row.employeeNo ?? null,
    row.employeeId ?? null,
    row.employeeName ?? null,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const firstToken = firstEmployeeNoToken(candidate) ?? candidate;
    const normalized = normalizeBiometricToken(firstToken);
    if (normalized) return normalized;
  }

  return null;
};

const resolveIdentities = async (tokens: string[]): Promise<Record<string, IdentityRecord>> => {
  const results: Record<string, IdentityRecord> = {};
  const uniqueTokens = Array.from(
    new Set(tokens.map((token) => normalizeBiometricToken(token)).filter((token) => token.length > 0))
  );
  if (!uniqueTokens.length) {
    return results;
  }

  const tokenSet = new Set(uniqueTokens);
  const matches = new Map<string, EmployeeCandidate[]>();

  if (identityMapModel) {
    const manualMappings = await identityMapModel.findMany({
      where: { token: { in: uniqueTokens } },
      include: {
        employee: {
          select: {
            id: true,
            employeeNo: true,
            isHead: true,
            firstName: true,
            lastName: true,
            middleName: true,
            suffix: true,
            updatedAt: true,
            offices: { select: { id: true, name: true } },
          },
        },
      },
    });

    for (const mapping of manualMappings) {
      if (!mapping.employee) continue;
      tokenSet.delete(mapping.token);
      const officeName = mapping.employee.offices?.name?.trim() || UNASSIGNED_OFFICE;
      const officeId = mapping.employee.offices?.id ?? null;
      results[mapping.token] = {
        employeeId: mapping.employee.id,
        employeeNo: normalizeEmployeeNo(mapping.employee.employeeNo),
        employeeName: formatEmployeeName({
          firstName: mapping.employee.firstName,
          lastName: mapping.employee.lastName,
          middleName: mapping.employee.middleName,
          suffix: mapping.employee.suffix,
          employeeNo: mapping.employee.employeeNo,
        }),
        officeId,
        officeName,
        status: "matched",
      };
    }
  } else {
    console.warn(
      "Biometrics identity map model is unavailable. Manual mappings will be skipped until migrations are applied."
    );
  }

  const orConditions = Array.from(tokenSet).flatMap((token) => {
    const baseToken = firstEmployeeNoToken(token) ?? token;
    return [
      { employeeNo: { startsWith: `${baseToken},` } },
      { employeeNo: { equals: baseToken } },
    ];
  });

  if (orConditions.length) {
    const batch = await prisma.employee.findMany({
      where: { OR: orConditions },
      select: {
        id: true,
        employeeNo: true,
        isHead: true,
        firstName: true,
        lastName: true,
        middleName: true,
        suffix: true,
        updatedAt: true,
        offices: { select: { id: true, name: true } },
      },
    });

    for (const candidate of batch) {
      const token = normalizeBiometricToken(firstEmployeeNoToken(candidate.employeeNo) ?? candidate.employeeNo ?? "");
      if (!token || !tokenSet.has(token)) continue;
      if (!matches.has(token)) {
        matches.set(token, []);
      }
      matches.get(token)!.push({
        id: candidate.id,
        employeeNo: candidate.employeeNo,
        isHead: candidate.isHead,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        middleName: candidate.middleName,
        suffix: candidate.suffix,
        updatedAt: candidate.updatedAt,
        office: candidate.offices ? { id: candidate.offices.id, name: candidate.offices.name } : null,
      });
    }
  }

  for (const token of uniqueTokens) {
    if (results[token]) continue;
    const candidates = matches.get(token) ?? [];
    if (!candidates.length) continue;
    const sorted = candidates.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    const primary = sorted[0]!;
    results[token] = {
      employeeId: primary.id,
      employeeNo: normalizeEmployeeNo(primary.employeeNo),
      employeeName: formatEmployeeName({
        firstName: primary.firstName,
        lastName: primary.lastName,
        middleName: primary.middleName,
        suffix: primary.suffix,
        employeeNo: primary.employeeNo,
      }),
      officeId: primary.office?.id ?? null,
      officeName: primary.office?.name?.trim() || UNASSIGNED_OFFICE,
      status: sorted.length > 1 ? "ambiguous" : "matched",
    };
  }

  return results;
};

const buildIdentityFromPerDayRow = (
  row: ParsedPerDayRow,
  resolved?: IdentityRecord
): IdentityRecord => {
  if (resolved) return resolved;
  const normalizedNo = normalizeEmployeeNo(row.employeeNo);
  if (row.employeeId) {
    return {
      employeeId: row.employeeId,
      employeeNo: normalizedNo ?? normalizeEmployeeNo(row.employeeToken) ?? row.employeeToken ?? null,
      employeeName: row.employeeName || UNKNOWN_EMPLOYEE_NAME,
      officeId: row.officeId ?? null,
      officeName: row.officeName ?? row.employeeDept ?? UNASSIGNED_OFFICE,
      status: "matched",
    };
  }
  return {
    employeeId: null,
    employeeNo: normalizedNo ?? normalizeEmployeeNo(row.employeeToken) ?? row.employeeToken ?? null,
    employeeName: row.employeeName || row.employeeToken || UNKNOWN_EMPLOYEE_NAME,
    officeId: row.officeId ?? null,
    officeName: row.officeName ?? row.employeeDept ?? UNKNOWN_OFFICE,
    status: "unmatched",
  };
};

const applyManualExclusionsToRow = (
  entry: RowEntry,
  manualByDate: Map<string, ManualExclusion[]>
) => {
  for (const [date, exclusions] of manualByDate.entries()) {
    const matches = exclusions.filter((exclusion) => matchesExclusion(exclusion, entry.identity));
    if (!matches.length) continue;
    const existing = entry.row.days[date] ?? {};
    entry.row.days[date] = {
      ...existing,
      excused: matches.map(exclusionLabel).join("; "),
    };
  }
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const metadataRaw = formData.get("metadata");
    if (typeof metadataRaw !== "string") {
      return NextResponse.json({ error: "Missing request metadata." }, { status: 400 });
    }

    const metadata = metadataSchema.parse(JSON.parse(metadataRaw));
    const files = formData.getAll("files").filter((item): item is File => item instanceof File);

    if (!files.length) {
      return NextResponse.json({ error: "At least one biometrics workbook is required." }, { status: 400 });
    }

    const parsedWorkbooks = [];
    for (const file of files) {
      try {
        const buffer = await file.arrayBuffer();
        parsedWorkbooks.push(parseBioAttendance(buffer, { fileName: file.name }));
      } catch (error) {
        console.error("Failed to parse workbook", file.name, error);
        const message =
          error instanceof Error ? error.message : "Unable to parse workbook. Please ensure it follows the biometrics template.";
        return NextResponse.json({ error: message }, { status: 422 });
      }
    }

    const merged = mergeParsedWorkbooks(parsedWorkbooks);
    const monthKey = `${metadata.year}-${String(metadata.month).padStart(2, "0")}`;
    const perDay = merged.perDay.filter((row) => row.dateISO.startsWith(monthKey));

    const resolutionTokens = Array.from(
      new Set(
        perDay
          .map((row) => deriveResolutionToken(row))
          .filter((token): token is string => Boolean(token))
      )
    );
    const identityMap = await resolveIdentities(resolutionTokens);

    const manualByDate = new Map<string, ManualExclusion[]>();
    for (const exclusion of metadata.manualExclusions) {
      for (const date of exclusion.dates) {
        const list = manualByDate.get(date) ?? [];
        list.push(exclusion);
        manualByDate.set(date, list);
      }
    }

    const rowMap = new Map<string, RowEntry>();

    for (const day of perDay) {
      const token = deriveResolutionToken(day);
      const resolvedIdentity = token ? identityMap[token] : undefined;
      const identity = buildIdentityFromPerDayRow(day, resolvedIdentity);
      if (!passesFilters(identity, metadata.employeeIds, metadata.officeIds)) continue;

      const key =
        identity.employeeId ??
        token ??
        normalizeEmployeeNo(day.employeeNo) ??
        day.employeeToken ??
        day.employeeName ??
        day.employeeId ??
        `${day.employeeToken ?? day.employeeName ?? "employee"}-${day.dateISO}`;

      const existing = rowMap.get(key);
      const baseRow: DTRPreviewRow = existing?.row ?? {
        employeeId: identity.employeeId ?? key,
        employeeNo:
          identity.employeeNo ??
          normalizeEmployeeNo(day.employeeNo) ??
          normalizeEmployeeNo(day.employeeToken) ??
          key,
        name: identity.employeeName ?? day.employeeName ?? UNKNOWN_EMPLOYEE_NAME,
        officeName: identity.officeName ?? day.officeName ?? day.employeeDept ?? undefined,
        days: {},
      };

      // prefer richer identity info on subsequent entries
      baseRow.name = identity.employeeName ?? baseRow.name;
      baseRow.employeeNo = identity.employeeNo ?? baseRow.employeeNo;
      baseRow.officeName = identity.officeName ?? baseRow.officeName ?? undefined;

      const entry: RowEntry = existing ?? { row: baseRow, identity };
      if (!existing) {
        rowMap.set(key, entry);
      }

      const slot = convertTimesToSlot(day.allTimes ?? []);

      if (manualByDate.has(day.dateISO)) {
        const matches = manualByDate
          .get(day.dateISO)!
          .filter((exclusion) => matchesExclusion(exclusion, entry.identity));
        if (matches.length) {
          slot.excused = matches.map(exclusionLabel).join("; ");
        }
      }

      entry.row.days[day.dateISO] = slot;
      entry.identity = identity;
    }

    if (metadata.employeeIds.length) {
      const presentIds = new Set(
        Array.from(rowMap.values())
          .map((entry) => entry.identity.employeeId)
          .filter((value): value is string => Boolean(value))
      );
      const missingIds = metadata.employeeIds.filter((id) => !presentIds.has(id));

      if (missingIds.length) {
        const employees = await prisma.employee.findMany({
          where: { id: { in: missingIds } },
          select: {
            id: true,
            employeeNo: true,
            firstName: true,
            lastName: true,
            middleName: true,
            suffix: true,
            offices: { select: { id: true, name: true } },
          },
        });

        for (const employee of employees) {
          const identity: IdentityRecord = {
            employeeId: employee.id,
            employeeNo: normalizeEmployeeNo(employee.employeeNo),
            employeeName: formatEmployeeName({
              firstName: employee.firstName,
              lastName: employee.lastName,
              middleName: employee.middleName,
              suffix: employee.suffix,
              employeeNo: employee.employeeNo,
            }),
            officeId: employee.offices?.id ?? null,
            officeName: employee.offices?.name?.trim() || UNASSIGNED_OFFICE,
            status: "matched",
          };
          if (!passesFilters(identity, metadata.employeeIds, metadata.officeIds)) continue;
          const key = identity.employeeId;
          if (!key) continue;
          if (!rowMap.has(key)) {
            rowMap.set(key, {
              identity,
              row: {
                employeeId: key,
                employeeNo: identity.employeeNo ?? key,
                name: identity.employeeName ?? UNKNOWN_EMPLOYEE_NAME,
                officeName: identity.officeName ?? undefined,
                days: {},
              },
            });
          }
        }
      }
    }

    for (const entry of rowMap.values()) {
      applyManualExclusionsToRow(entry, manualByDate);
    }

    const rows = Array.from(rowMap.values())
      .map((entry) => entry.row)
      .sort((a, b) => a.name.localeCompare(b.name));

    const preview: DTRPreview = {
      month: metadata.month,
      year: metadata.year,
      rows,
    };

    return NextResponse.json({ preview });
  } catch (error) {
    console.error("Failed to generate Auto DTR preview", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unable to generate preview.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

