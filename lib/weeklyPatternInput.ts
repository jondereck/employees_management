import { z } from "zod";

import {
  HHMM_REGEX,
  sanitizeWeeklyPattern,
  validateWeeklyPatternDay,
  type WeeklyPattern,
  type WeeklyPatternDay,
  type WeeklyPatternWindow,
} from "@/utils/weeklyPattern";

const weeklyPatternWindowSchema = z.object({
  start: z.string().regex(HHMM_REGEX, "Start must be HH:MM"),
  end: z.string().regex(HHMM_REGEX, "End must be HH:MM"),
});

const weeklyPatternDaySchemaBase = z.object({
  windows: z.array(weeklyPatternWindowSchema).max(3),
  requiredMinutes: z.coerce.number().int().min(0).max(1440),
});

export const weeklyPatternDaySchema = weeklyPatternDaySchemaBase.superRefine((value, ctx) => {
  const candidate: WeeklyPatternDay = {
    windows: value.windows.map((window) => ({
      start: window.start as WeeklyPatternWindow["start"],
      end: window.end as WeeklyPatternWindow["end"],
    })),
    requiredMinutes: value.requiredMinutes,
  };

  const error = validateWeeklyPatternDay(candidate);
  if (error) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
  }
});

export const weeklyPatternSchema = z
  .object({
    mon: weeklyPatternDaySchema.optional(),
    tue: weeklyPatternDaySchema.optional(),
    wed: weeklyPatternDaySchema.optional(),
    thu: weeklyPatternDaySchema.optional(),
    fri: weeklyPatternDaySchema.optional(),
    sat: weeklyPatternDaySchema.optional(),
    sun: weeklyPatternDaySchema.optional(),
  })
  .partial();

export type WeeklyPatternInput = z.infer<typeof weeklyPatternSchema> | null;

export const weeklyPatternInputSchema = z
  .union([weeklyPatternSchema, z.null()])
  .optional()
  .transform((value) => (value == null ? null : value));

export const normalizeWeeklyPatternInput = (
  input: WeeklyPatternInput | undefined
): WeeklyPattern | null => {
  if (!input) return null;
  return sanitizeWeeklyPattern(input);
};
