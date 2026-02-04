// utils/computeStep.ts
export function computeStep({
  dateHired,
  latestAppointment,
  maxStep = 8,
}: {
  dateHired?: Date | string;
  latestAppointment?: Date | string;
  maxStep?: number;
}): number {
  const normalize = (d?: Date | string): Date | null => {
    if (!d) return null;
    const parsed = d instanceof Date ? d : new Date(d);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const base = normalize(latestAppointment) ?? normalize(dateHired);
  if (!base) return 1;

  const now = new Date();

  // Guard against future dates
  if (base > now) return 1;

  let years =
    now.getFullYear() - base.getFullYear();

  const m = now.getMonth() - base.getMonth();
  const d = now.getDate() - base.getDate();

  if (m < 0 || (m === 0 && d < 0)) {
    years -= 1;
  }

  // Defensive clamp
  if (!Number.isFinite(years) || years < 0) {
    years = 0;
  }

  const safeMaxStep =
    Number.isFinite(maxStep) && maxStep >= 1 ? maxStep : 1;

  const stepIncrease = Math.floor(years / 3);
  const step = stepIncrease + 1;
  
if (process.env.NODE_ENV !== "production") {
  const result = Math.min(Math.max(1, step), safeMaxStep);
  if (result < 1) {
    throw new Error("computeStep invariant violated: step < 1");
  }
}

  // 🔒 Final invariant enforcement
  return Math.min(Math.max(1, step), safeMaxStep);
}
