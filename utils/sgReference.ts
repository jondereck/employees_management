export const SG_REFERENCE_MONTHLY: Record<number, number> = {
  1: 13000,
  2: 13800,
  3: 14600,
  4: 15400,
  5: 16200,
  6: 17000,
  7: 17800,
  8: 18600,
  9: 19400,
  10: 20200,
  11: 21000,
  12: 21800,
  13: 22600,
  14: 23400,
  15: 24200,
  16: 25000,
  17: 25800,
  18: 26600,
  19: 27400,
  20: 28200,
  21: 29000,
  22: 29800,
  23: 30600,
  24: 31400,
  25: 32200,
  26: 33000,
  27: 33800,
  28: 34600,
  29: 35400,
  30: 36200,
  31: 37000,
  32: 37800,
  33: 38600,
};

export function getReferenceSalary(sg: number): number | null {
  if (sg <= 0) return null;
  return SG_REFERENCE_MONTHLY[sg] ?? null;
}

