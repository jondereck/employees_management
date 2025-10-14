export type HHMM = `${number}${number}:${number}${number}`;

export type ScheduleFixed = {
  type: "FIXED";
  startTime: HHMM;
  endTime: HHMM;
  breakMinutes?: number;
  graceMinutes?: number;
};
export type ScheduleFlex = {
  type: "FLEX";
  coreStart: HHMM;
  coreEnd: HHMM;
  bandwidthStart: HHMM;
  bandwidthEnd: HHMM;
  requiredDailyMinutes: number;
  breakMinutes?: number;
};
export type ScheduleShift = {
  type: "SHIFT";
  shiftStart: HHMM;
  shiftEnd: HHMM;
  breakMinutes?: number;
  graceMinutes?: number;
};

export type Schedule = ScheduleFixed | ScheduleFlex | ScheduleShift;

export type DayEvalInput = {
  dateISO: string;
  earliest?: HHMM | null;
  latest?: HHMM | null;
  allTimes?: HHMM[];
  schedule: Schedule;
};

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const minToHHMM = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function evaluateDay(input: DayEvalInput) {
  const e = input.earliest ? toMin(input.earliest) : null;
  const l = input.latest ? toMin(input.latest) : null;

  const breakMin =
    "breakMinutes" in input.schedule && input.schedule.breakMinutes
      ? input.schedule.breakMinutes
      : 60;

  let worked = 0;                  // <- was const; now mutable
  let isLate = false;
  let isUndertime = false;

  switch (input.schedule.type) {
    case "FIXED": {
      const start = toMin(input.schedule.startTime);
      const end = toMin(input.schedule.endTime);
      const grace = input.schedule.graceMinutes ?? 0;

      const span = e != null && l != null && l >= e ? l - e : 0;
      worked = Math.max(0, span - breakMin);

      if (e != null) isLate = e > start + grace;
      const required = end - start - breakMin;
      isUndertime = worked < required;
      break;
    }

    case "FLEX": {
      const coreS = toMin(input.schedule.coreStart);
      const coreE = toMin(input.schedule.coreEnd);
      const bandS = toMin(input.schedule.bandwidthStart);
      const bandE = toMin(input.schedule.bandwidthEnd);
      const req   = input.schedule.requiredDailyMinutes;

      // No punches -> late & undertime
      if (e == null || l == null) {
        worked = 0;
        isLate = true;
        isUndertime = true;
        break;
      }

      // Allow early-in: clamp presence to the bandwidth window
      const effectiveStart = Math.max(e, bandS);
      const effectiveEnd   = Math.min(l, bandE);

      // No time within the allowed band
      if (effectiveEnd <= effectiveStart) {
        worked = 0;
        isLate = true;
        isUndertime = true;
        break;
      }

      // Work only counts inside the band
      const workedRaw = effectiveEnd - effectiveStart;
      worked = Math.max(0, workedRaw - breakMin);

      // Present during core? (overlap between clamped presence and core)
      const overlapStart = Math.max(effectiveStart, coreS);
      const overlapEnd   = Math.min(effectiveEnd, coreE);
      const presentInCore = overlapEnd > overlapStart;

      // Late only if arrived after core start OR missed core entirely
      isLate = (effectiveStart > coreS) || !presentInCore;

      // Undertime by required minutes
      isUndertime = worked < req;
      break;
    }

    case "SHIFT": {
      let shiftStart = toMin(input.schedule.shiftStart);
      let shiftEnd   = toMin(input.schedule.shiftEnd);
      const grace = input.schedule.graceMinutes ?? 0;

      if (shiftEnd <= shiftStart) shiftEnd += 24 * 60; // overnight

      const span = e != null && l != null && l >= e ? l - e : 0;
      worked = Math.max(0, span - breakMin);

      if (e != null) isLate = e > shiftStart + grace;

      const planned = shiftEnd - shiftStart - breakMin;
      isUndertime = worked < planned;
      break;
    }
  }

  return {
    workedMinutes: worked,
    workedHHMM: minToHHMM(worked),
    isLate,
    isUndertime,
  };
}
