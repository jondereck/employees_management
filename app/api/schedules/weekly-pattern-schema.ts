import { z } from "zod";

import { hasOverlaps } from "@/utils/weeklyPattern";

const hhmmStrict = z.string().regex(/^\d{2}:\d{2}$/);

const weeklyPatternWindowSchema = z.object({
  start: hhmmStrict,
  end: hhmmStrict,
});

const weeklyPatternDaySchema = z
  .object({
    windows: z.array(weeklyPatternWindowSchema).min(1).max(3),
    requiredMinutes: z.coerce.number().int().min(0).max(1440),
  })
  .superRefine((data, ctx) => {
    if (hasOverlaps(data.windows)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["windows"],
        message: "Windows within a day must not overlap.",
      });
    }
    for (const [index, window] of data.windows.entries()) {
      if (window.start === window.end) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["windows", index],
          message: "Start time must differ from end time.",
        });
      }
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

export type WeeklyPatternInput = z.infer<typeof weeklyPatternSchema>;
