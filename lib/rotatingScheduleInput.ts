import { z } from "zod";

import {
  ROTATION_HHMM_REGEX,
  ROTATION_MAX_DAYS,
  ROTATION_MIN_DAYS,
  sanitizeRotationPattern,
  type RotationPattern,
} from "@/utils/rotatingSchedule";

const rotationWorkDaySchema = z.object({
  kind: z.literal("WORK"),
  start: z.string().regex(ROTATION_HHMM_REGEX, "Start must be HH:MM"),
  end: z.string().regex(ROTATION_HHMM_REGEX, "End must be HH:MM"),
  breakMinutes: z.coerce.number().int().min(0).max(720).optional(),
  graceMinutes: z.coerce.number().int().min(0).max(180).optional(),
});

const rotationOffDaySchema = z.object({
  kind: z.literal("OFF"),
});

export const rotationPatternSchema = z.object({
  days: z
    .array(z.discriminatedUnion("kind", [rotationWorkDaySchema, rotationOffDaySchema]))
    .min(ROTATION_MIN_DAYS)
    .max(ROTATION_MAX_DAYS),
}).superRefine((value, ctx) => {
  if (!value.days.some((day) => day.kind === "WORK")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["days"],
      message: "At least one rotation day must be a work day",
    });
  }
  value.days.forEach((day, index) => {
    if (day.kind === "WORK" && day.start === day.end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["days", index, "end"],
        message: "Start and end must not be the same",
      });
    }
  });
});

export const rotationPatternInputSchema = z
  .union([rotationPatternSchema, z.null()])
  .optional()
  .transform((value) => (value == null ? null : value));

export type RotationPatternInput = z.infer<typeof rotationPatternSchema> | null;

export const normalizeRotationPatternInput = (
  input: RotationPatternInput | undefined
): RotationPattern | null => {
  if (!input) return null;
  return sanitizeRotationPattern(input);
};
