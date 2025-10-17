import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { toWeeklyExclusionDto, toIgnoreUntilDate } from "@/lib/weeklyExclusions";

const HHMM_REGEX = /^\d{1,2}:\d{2}$/;

const WeeklyExclusionModeSchema = z.enum(["EXCUSED", "IGNORE_LATE_UNTIL"] as const);

const createSchema = z
  .object({
    weekday: z.number().int().min(1).max(7),
    mode: WeeklyExclusionModeSchema,
    ignoreUntil: z.string().nullable().optional(),
    effectiveFrom: z.string().min(1),
    effectiveTo: z.string().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    const trimmed = data.ignoreUntil?.trim() ?? "";
    if (data.mode === "IGNORE_LATE_UNTIL") {
      if (!trimmed || !HHMM_REGEX.test(trimmed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["ignoreUntil"],
          message: "Enter time as HH:MM (e.g., 08:30)",
        });
      }
    }
    if (data.effectiveTo && data.effectiveTo < data.effectiveFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["effectiveTo"],
        message: "Effective to must be on or after effective from",
      });
    }
  });

const parseDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

const rangesOverlap = (
  startA: Date,
  endA: Date | null,
  startB: Date,
  endB: Date | null
) => {
  const endValueA = endA ?? new Date("9999-12-31T23:59:59.999Z");
  const endValueB = endB ?? new Date("9999-12-31T23:59:59.999Z");
  return startA <= endValueB && startB <= endValueA;
};

export async function POST(
  request: Request,
  { params }: { params: { employeeId: string } }
) {
  try {
    const employeeId = params.employeeId;
    if (!employeeId) {
      return NextResponse.json({ error: "Employee ID is required" }, { status: 400 });
    }

    const payload = createSchema.parse(await request.json());
    const effectiveFrom = parseDate(payload.effectiveFrom);
    const effectiveTo = payload.effectiveTo ? parseDate(payload.effectiveTo) : null;

    const existing = await prisma.weeklyExclusion.findMany({
      where: { employeeId, weekday: payload.weekday },
    });
    const overlapping = existing.find((entry) =>
      rangesOverlap(effectiveFrom, effectiveTo, entry.effectiveFrom, entry.effectiveTo)
    );
    if (overlapping) {
      return NextResponse.json(
        {
          error: `Overlaps with existing exclusion (${payload.weekday}) starting ${overlapping.effectiveFrom
            .toISOString()
            .slice(0, 10)}`,
        },
        { status: 400 }
      );
    }

    const ignoreUntilDate =
      payload.mode === "IGNORE_LATE_UNTIL"
        ? toIgnoreUntilDate(payload.ignoreUntil?.trim() ?? "")
        : null;

    const record = await prisma.weeklyExclusion.create({
      data: {
        employeeId,
        weekday: payload.weekday,
        mode: payload.mode,
        ignoreUntil: ignoreUntilDate,
        effectiveFrom,
        effectiveTo,
      },
    });

    return NextResponse.json(toWeeklyExclusionDto(record));
  } catch (error) {
    console.error("Failed to create weekly exclusion", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const message =
      error instanceof Error ? error.message : "Unable to create weekly exclusion";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
