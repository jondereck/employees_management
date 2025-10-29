import { NextResponse } from "next/server";
import { z } from "zod";

import {
  evaluateAttendanceEntries,
  type EvaluationEntry,
} from "@/lib/attendance/evaluateEntries";
import type { ManualExclusion } from "@/types/manual-exclusion";

const hhmmRegex = /^\d{1,2}:\d{2}$/;

const Punch = z.object({
  time: z.string().regex(hhmmRegex),
  minuteOfDay: z.number().int().min(0).max(1439),
  source: z.enum(["original", "merged"]),
  files: z.array(z.string()),
});

const Row = z.object({
  employeeId: z.string().min(1),
  employeeName: z.string().min(1),
  resolvedEmployeeId: z.string().min(1).nullable().optional(),
  officeId: z.string().min(1).nullable().optional(),
  officeName: z.string().min(1).nullable().optional(),
  employeeToken: z.string().min(1),
  dateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  day: z.number().int().min(1).max(31),
  earliest: z.string().regex(hhmmRegex).nullable().optional(),
  latest: z.string().regex(hhmmRegex).nullable().optional(),
  allTimes: z.array(z.string().regex(hhmmRegex)).default([]),
  punches: z.array(Punch).default([]),
  sourceFiles: z.array(z.string()).default([]),
  composedFromDayOnly: z.boolean().optional(),
});

const ManualExclusionSchema = z
  .object({
    id: z.string().min(1),
    dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nonempty(),
    scope: z.enum(["all", "offices", "employees"]),
    officeIds: z.array(z.string().min(1)).optional(),
    employeeIds: z.array(z.string().min(1)).optional(),
    reason: z.enum([
      "SUSPENSION",
      "OFFICE_CLOSURE",
      "CALAMITY",
      "TRAINING",
      "LEAVE",
      "LOCAL_HOLIDAY",
      "OTHER",
    ]),
    note: z.string().trim().min(1).optional(),
    otEligible: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.scope === "offices" && !(value.officeIds?.length)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Office exclusions require at least one officeId." });
    }
    if (value.scope === "employees" && !(value.employeeIds?.length)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Employee exclusions require at least one employeeId." });
    }
  });

const Payload = z.object({
  entries: z.array(Row),
  manualExclusions: z.array(ManualExclusionSchema).optional(),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { entries, manualExclusions = [] } = Payload.parse(json);

    const payloadEntries: EvaluationEntry[] = entries.map((entry) => ({
      employeeId: entry.employeeId,
      employeeName: entry.employeeName,
      employeeToken: entry.employeeToken.trim(),
      resolvedEmployeeId: entry.resolvedEmployeeId ?? null,
      officeId: entry.officeId ?? null,
      officeName: entry.officeName ?? null,
      dateISO: entry.dateISO,
      day: entry.day,
      earliest: entry.earliest ?? null,
      latest: entry.latest ?? null,
      allTimes: entry.allTimes,
      punches: entry.punches,
      sourceFiles: entry.sourceFiles,
      composedFromDayOnly: entry.composedFromDayOnly ?? false,
    }));

    const result = await evaluateAttendanceEntries(payloadEntries, {
      manualExclusions: manualExclusions as ManualExclusion[],
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to re-enrich biometrics entries", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unable to re-enrich biometrics entries.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

