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

  const breakMin = "breakMinutes" in input.schedule && input.schedule.breakMinutes
    ? input.schedule.breakMinutes
    : 60;

  const span = e != null && l != null && l >= e ? l - e : 0;
  const worked = Math.max(0, span - breakMin);

  let isLate = false;
  let isUndertime = false;

  switch (input.schedule.type) {
    case "FIXED": {
      const start = toMin(input.schedule.startTime);
      const end = toMin(input.schedule.endTime);
      const grace = input.schedule.graceMinutes ?? 0;
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
      const req = input.schedule.requiredDailyMinutes;

      const inBand = e != null && e >= bandS && l != null && l <= bandE;
      const presentInCore = (() => {
        if (e == null || l == null) return false;
        const overlap = clamp(l, coreS, coreE) - clamp(e, coreS, coreE);
        return overlap > 0;
      })();

      isLate = e != null ? e > coreS : true;
      if (!inBand || !presentInCore) {
        isLate = true;
      }

      isUndertime = worked < req;
      break;
    }
    case "SHIFT": {
      let shiftStart = toMin(input.schedule.shiftStart);
      let shiftEnd = toMin(input.schedule.shiftEnd);
      const grace = input.schedule.graceMinutes ?? 0;
      if (shiftEnd <= shiftStart) {
        shiftEnd += 24 * 60;
      }
      if (e != null) {
        let adjustedE = e;
        if (l != null && l < e) {
          adjustedE = l;
        }
        isLate = adjustedE > shiftStart + grace;
      }
      const planned = shiftEnd - shiftStart - breakMin;
      isUndertime = worked < planned;
      break;
    }
  }

  return { workedMinutes: worked, workedHHMM: minToHHMM(worked), isLate, isUndertime };
}
