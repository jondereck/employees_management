import type { HHMM } from "@/utils/evaluateDay";

export type OvertimeRounding = "none" | "nearest15" | "nearest30";

export type FlexOTMode = "strict" | "soft";

export interface OvertimePolicy {
  rounding: OvertimeRounding;
  graceAfterEndMin: number;
  countPreShift: boolean;
  minBlockMin: number;
  mealDeductMin?: number;
  mealTriggerMin?: number;
  nightDiffEnabled: boolean;
  flexMode: FlexOTMode;
  overtimeOnExcused: boolean;
}

export interface WorkSchedule {
  startTime: HHMM;
  endTime: HHMM;
}

export interface EvaluationOptions {
  overtime: OvertimePolicy;
  workSchedule?: WorkSchedule;
}
