import { ScheduleType } from "@prisma/client";
import { z } from "zod";

import {
  normalizeWeeklyPatternInput,
  weeklyPatternInputSchema,
} from "@/lib/weeklyPatternInput";

const timekeepingScheduleShape = {
    id: z.string().min(1).optional(),
    officeId: z.string().min(1).optional(),
    employeeId: z.string().min(1).optional(),
    type: z.nativeEnum(ScheduleType),
    startTime: z.string().optional().nullable(),
    endTime: z.string().optional().nullable(),
    graceMinutes: z.coerce.number().int().min(0).max(180).optional().nullable(),
    coreStart: z.string().optional().nullable(),
    coreEnd: z.string().optional().nullable(),
    bandwidthStart: z.string().optional().nullable(),
    bandwidthEnd: z.string().optional().nullable(),
    requiredDailyMinutes: z.coerce.number().int().min(0).max(1440).optional().nullable(),
    shiftStart: z.string().optional().nullable(),
    shiftEnd: z.string().optional().nullable(),
    breakMinutes: z.coerce.number().int().min(0).max(720).optional().default(60),
    timezone: z.string().optional().default("Asia/Manila"),
    effectiveFrom: z.string().min(1, "Effective from date is required"),
    effectiveTo: z.string().optional().nullable(),
    weeklyPattern: weeklyPatternInputSchema.optional(),
  };

export const timekeepingScheduleBaseSchema = z.object(timekeepingScheduleShape);

const validateScheduleFields = (
  data: z.infer<typeof timekeepingScheduleBaseSchema>,
  ctx: z.RefinementCtx
) => {
    if (data.type === ScheduleType.FIXED && (!data.startTime || !data.endTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Start and end times are required for fixed schedules",
        path: ["startTime"],
      });
    }
    if (data.type === ScheduleType.FLEX) {
      const required = ["coreStart", "coreEnd", "bandwidthStart", "bandwidthEnd", "requiredDailyMinutes"] as const;
      for (const key of required) {
        if (!data[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "All flex schedule fields are required",
            path: [key],
          });
        }
      }
    }
    if (data.type === ScheduleType.SHIFT && (!data.shiftStart || !data.shiftEnd)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Shift start and end are required",
        path: ["shiftStart"],
      });
    }
    if (data.type === ScheduleType.ROTATING) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Rotating schedules are only supported for individual employees.",
        path: ["type"],
      });
    }
  };

export const timekeepingScheduleSchema = timekeepingScheduleBaseSchema.superRefine(validateScheduleFields);

export const timekeepingOfficeScheduleSchema = timekeepingScheduleBaseSchema
  .extend({
    officeId: z.string().min(1),
  })
  .superRefine(validateScheduleFields);

export type TimekeepingScheduleInput = z.infer<typeof timekeepingScheduleSchema>;

export const toScheduleWriteData = (payload: TimekeepingScheduleInput) => {
  const weeklyPattern =
    payload.weeklyPattern === undefined
      ? undefined
      : normalizeWeeklyPatternInput(payload.weeklyPattern);

  return {
    type: payload.type,
    startTime: payload.startTime ?? null,
    endTime: payload.endTime ?? null,
    graceMinutes: payload.graceMinutes ?? null,
    coreStart: payload.coreStart ?? null,
    coreEnd: payload.coreEnd ?? null,
    bandwidthStart: payload.bandwidthStart ?? null,
    bandwidthEnd: payload.bandwidthEnd ?? null,
    requiredDailyMinutes: payload.requiredDailyMinutes ?? null,
    shiftStart: payload.shiftStart ?? null,
    shiftEnd: payload.shiftEnd ?? null,
    breakMinutes: payload.breakMinutes ?? 60,
    timezone: payload.timezone ?? "Asia/Manila",
    effectiveFrom: new Date(payload.effectiveFrom),
    effectiveTo: payload.effectiveTo ? new Date(payload.effectiveTo) : null,
    ...(weeklyPattern !== undefined ? { weeklyPattern } : {}),
  };
};
