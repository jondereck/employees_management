// utils/computeStep.ts
export function computeStep({
  dateHired,
  latestAppointment,
  maxStep = 8,
}: {
  dateHired?: Date | string;
  latestAppointment?: Date | string;
  maxStep?: number;
}) {
  const normalize = (d?: Date | string) => {
    if (!d) return undefined;
    if (d instanceof Date) return d;
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? undefined : parsed;
  };

  const base = normalize(latestAppointment) ?? normalize(dateHired);
  if (!base) return 1;

  // Full years difference (month/day aware)
  const now = new Date();
  let years = now.getFullYear() - base.getFullYear();
  const m = now.getMonth() - base.getMonth();
  const d = now.getDate() - base.getDate();
  if (m < 0 || (m === 0 && d < 0)) years -= 1;

  const stepIncrease = Math.floor(years / 3);
  return Math.max(1, Math.min(stepIncrease + 1, maxStep));
}
