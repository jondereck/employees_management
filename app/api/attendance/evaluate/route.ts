import { NextResponse } from "next/server";
import { z } from "zod";

import { evaluateAttendanceEntries, type EvaluationEntry } from "@/lib/attendance/evaluateEntries";
import type { ManualExclusion } from "@/types/manual-exclusion";

export const runtime = "nodejs";

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

const OvertimePolicySchema = z.object({
  rounding: z.enum(["none", "nearest15", "nearest30"]).default("nearest15"),
  graceAfterEndMin: z.number().int().min(0).default(0),
  countPreShift: z.boolean().default(false),
  minBlockMin: z.number().int().min(0).default(0),
  mealDeductMin: z.number().int().min(0).optional().nullable(),
  mealTriggerMin: z.number().int().min(0).optional().nullable(),
  nightDiffEnabled: z.boolean().default(false),
  flexMode: z.enum(["strict", "soft"]).default("strict"),
  overtimeOnExcused: z.boolean().default(true),
});

const EvaluationOptionsSchema = z
  .object({
    overtime: OvertimePolicySchema,
  })
  .optional();

const Payload = z.object({
  entries: z.array(Row),
  manualExclusions: z.array(ManualExclusionSchema).optional(),
  evaluationOptions: EvaluationOptionsSchema,
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { entries, manualExclusions = [], evaluationOptions } = Payload.parse(json);

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

    const normalizedOvertime =
      evaluationOptions?.overtime == null
        ? undefined
        : {
          ...evaluationOptions.overtime,
          // convert nullable fields to undefined so types align
          mealDeductMin:
            evaluationOptions.overtime.mealDeductMin ?? undefined,
          mealTriggerMin:
            evaluationOptions.overtime.mealTriggerMin ?? undefined,
        };

    const result = await evaluateAttendanceEntries(payloadEntries, {
      manualExclusions: manualExclusions as ManualExclusion[],
      evaluationOptions: normalizedOvertime ? { overtime: normalizedOvertime } : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to evaluate attendance", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to evaluate attendance";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

