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

  let worked = 0;
  let isLate = false;
  let isUndertime = false;
  let lateMinutes: number | null = null;
  let undertimeMinutes: number | null = null;
  let requiredMinutes: number | null = null;
  let scheduleStart: HHMM | null = null;
  let scheduleEnd: HHMM | null = null;
  let scheduleGraceMinutes: number | null = null;

  switch (input.schedule.type) {
    case "FIXED": {
      const start = toMin(input.schedule.startTime);
      const end = toMin(input.schedule.endTime);
      const grace = input.schedule.graceMinutes ?? 0;
      scheduleStart = input.schedule.startTime;
      scheduleEnd = input.schedule.endTime;
      scheduleGraceMinutes = grace;

      const span = e != null && l != null && l >= e ? l - e : 0;
      worked = Math.max(0, span - breakMin);

      if (e != null) isLate = e > start + grace;
      const required = Math.max(0, end - start - breakMin);
      requiredMinutes = required;
      isUndertime = worked < required;
      if (e != null) {
        lateMinutes = Math.max(0, e - (start + grace));
      }
      undertimeMinutes = Math.max(0, required - worked);
      break;
    }

    case "FLEX": {
      const coreS = toMin(input.schedule.coreStart);
      const coreE = toMin(input.schedule.coreEnd);
      const bandS = toMin(input.schedule.bandwidthStart);
      const bandE = toMin(input.schedule.bandwidthEnd);
      const req   = input.schedule.requiredDailyMinutes;
      scheduleStart = input.schedule.coreStart;
      scheduleEnd = input.schedule.coreEnd;
      requiredMinutes = req;

      // No punches -> late & undertime
      if (e == null || l == null) {
        worked = 0;
        isLate = true;
        isUndertime = true;
        lateMinutes = coreE - coreS;
        undertimeMinutes = req;
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
        lateMinutes = coreE - coreS;
        undertimeMinutes = req;
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
      undertimeMinutes = Math.max(0, req - worked);

      if (isLate) {
        let late = 0;
        if (effectiveStart > coreS) {
          late += effectiveStart - coreS;
        }
        if (!presentInCore) {
          late = Math.max(late, coreE - coreS);
        }
        lateMinutes = late;
      } else {
        lateMinutes = 0;
      }
      break;
    }

    case "SHIFT": {
      let shiftStart = toMin(input.schedule.shiftStart);
      let shiftEnd   = toMin(input.schedule.shiftEnd);
      const grace = input.schedule.graceMinutes ?? 0;
      scheduleStart = input.schedule.shiftStart;
      scheduleEnd = input.schedule.shiftEnd;
      scheduleGraceMinutes = grace;

      if (shiftEnd <= shiftStart) shiftEnd += 24 * 60; // overnight

      const span = e != null && l != null && l >= e ? l - e : 0;
      worked = Math.max(0, span - breakMin);

      if (e != null) isLate = e > shiftStart + grace;
      const planned = Math.max(0, shiftEnd - shiftStart - breakMin);
      requiredMinutes = planned;
      isUndertime = worked < planned;
      if (e != null) {
        lateMinutes = Math.max(0, e - (shiftStart + grace));
      }
      undertimeMinutes = Math.max(0, planned - worked);
      break;
    }
  }

  return {
    workedMinutes: worked,
    workedHHMM: minToHHMM(worked),
    isLate,
    isUndertime,
    lateMinutes,
    undertimeMinutes,
    requiredMinutes,
    scheduleStart,
    scheduleEnd,
    scheduleGraceMinutes,
  };
}
