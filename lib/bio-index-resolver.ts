// lib/bio-index-resolver.ts
import { OFFICE_INDEX_CODE_BY_ID } from "./bio-index-map";

export function normName(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

// Optional fallback by normalized name
export const OFFICE_INDEX_CODE_BY_NAME_NORM: Readonly<Record<string, string>> = Object.freeze({
  // "hrmo": "854000",
  // "menro": "631000",
  // "rhu 3": "205000",
});

function isValidIndex(code?: string) {
  return !!code && /^\d+$/.test(code);        // if you want strict length: && code.length === 6
}

export function resolveIndexCode(args: { officeId?: string; officeName?: string }): string | undefined {
  const { officeId, officeName } = args;

  if (officeId) {
    const byId = OFFICE_INDEX_CODE_BY_ID[officeId];
    if (isValidIndex(byId)) return byId;
  }

  if (officeName) {
    const byName = OFFICE_INDEX_CODE_BY_NAME_NORM[normName(officeName)];
    if (isValidIndex(byName)) return byName;
  }

  return undefined;
}
