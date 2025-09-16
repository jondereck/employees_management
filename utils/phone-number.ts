// utils/phone.ts
export function normalizePHMobileLive(input: string): string {
  // keep digits only
  let d = (input ?? "").replace(/\D/g, "");

  // tolerate intl prefixes
  if (d.startsWith("009")) d = d.slice(2);   // 009... -> 9...
  if (d.startsWith("63")) d = d.slice(2);    // 63xxxxxxxxxx -> xxxxxxxxxx

  // if starts with '9', treat as local 10-digit mobile; add leading 0,
  // then clamp to exactly 11 total (0 + 10 digits)
  if (d.startsWith("9")) {
    d = "0" + d.slice(0, 10);
    return d;
  }

  // if starts with '0', clamp to 11
  if (d.startsWith("0")) {
    return d.slice(0, 11);
  }

  // anything else: just clamp to 11; if later they type 9 first, logic above will apply
  return d.slice(0, 11);
}

// for display only (doesn't change the raw value)
export function formatPHPretty(raw: string): string {
  const d = (raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  const p1 = d.slice(0, 4);
  const p2 = d.slice(4, 7);
  const p3 = d.slice(7, 11);
  return [p1, p2, p3].filter(Boolean).join("-");
}
