/**
 * Canonical row orders for annex-style reports (Annex 3-E, Annex 6-H, etc.).
 * Keep office aliases loose so DB names like "Mayors Office" still match.
 */

export type CanonicalOrderRule = {
  /** Annex / display label used when documenting the order. */
  label: string;
  /** True when a live office/education name belongs to this slot. */
  match: (name: string) => boolean;
};

function ci(...patterns: string[]) {
  const regs = patterns.map((p) => new RegExp(p, "i"));
  return (name: string) => regs.some((r) => r.test(name));
}

/** Education categories highest → lowest (Annex 3-E section D). */
export const ANNEX_EDUCATION_ORDER = [
  "Doctorate Degree",
  "Master's Degree",
  "College Graduate",
  "College Undergraduate",
  "Vocational/Technical",
  "High School Graduate",
  "Elementary",
  "Others/Unclassified",
] as const;

/** Official 5-row Annex 3-E education set (always shown even when empty). */
export const ANNEX_EDUCATION_OFFICIAL = new Set([
  "High School Graduate",
  "Vocational/Technical",
  "College Graduate",
  "Master's Degree",
  "Doctorate Degree",
]);

/**
 * LGU office sequence for Annex 3-E B and Annex 6-H III.
 * Order matches the official department sheet (Mayor → BAC).
 */
export const ANNEX_OFFICE_ORDER: CanonicalOrderRule[] = [
  {
    label: "Office of the Municipal Mayor",
    match: (n) => /\bmayor/i.test(n) && !/\bvice\b/i.test(n),
  },
  { label: "Vice Mayor's Office", match: ci("vice\\s*mayor") },
  {
    label: "Administrator's Office",
    match: ci("administrator"),
  },
  {
    label: "Office of the Municipal Secretary of the Sangguniang Bayan",
    match: ci(
      "municipal secretary.*sangguniang",
      "sangguniang bayan secretar",
      "\\bSB\\s*Secretary\\b",
      "office of the sb secretary"
    ),
  },
  { label: "Human Resource Management Office", match: ci("human resource", "\\bHRMO\\b") },
  {
    label: "Municipal Planning and Development Office (MPDO)",
    match: ci("planning and development", "\\bMPDO\\b"),
  },
  {
    label: "Municipal Registrar Office",
    match: ci("civil registrar", "municipal registrar", "\\bMCR\\b"),
  },
  { label: "Municipal Budget Office", match: ci("budget") },
  { label: "Municipal Accounting Office", match: ci("accounting") },
  { label: "Municipal Treasurer's Office", match: ci("treasurer") },
  { label: "Municipal Assessor Office", match: ci("assessor") },
  { label: "Municipal Information Office", match: ci("information office", "^information\\b") },
  { label: "Municipal Legal Office", match: ci("legal office", "^legal\\b") },
  {
    label: "Rural Health Unit I (RHU I)",
    match: ci("rural health unit\\s*I\\b", "\\bRHU\\s*I\\b", "\\bRHU\\s*1\\b"),
  },
  {
    label: "Rural Health Unit II (RHU II)",
    match: ci("rural health unit\\s*II\\b", "\\bRHU\\s*II\\b", "\\bRHU\\s*2\\b"),
  },
  {
    label: "Rural Health Unit III (RHU III)",
    match: ci("rural health unit\\s*III\\b", "\\bRHU\\s*III\\b", "\\bRHU\\s*3\\b"),
  },
  {
    label: "Municipal Social Welfare and Development Office (MSWDO)",
    match: ci("social welfare", "\\bMSWDO\\b"),
  },
  { label: "Municipal Agriculture Office", match: ci("agriculture") },
  { label: "Municipal Engineering Office", match: ci("engineering") },
  {
    label: "Market & Slaughterhouse",
    match: ci("market\\s*&\\s*slaughter", "market office", "slaughterhouse"),
  },
  {
    label: "Municipal Environment & Natural Resources Office (MENRO)",
    match: ci("environment.*natural resources", "\\bMENRO\\b"),
  },
  { label: "General Service Office (GSO)", match: ci("general service", "\\bGSO\\b") },
  {
    label: "Municipal Tourism Office",
    match: ci("tourism", "\\bLTCAO\\b"),
  },
  {
    label: "Local Disaster Risk Reduction and Management Office",
    match: ci("disaster risk", "\\bLDRRM", "\\bLDRRMO\\b", "\\bLDRRMC\\b"),
  },
  {
    label: "Bureau of Fire Protection (BFP Lingayen)",
    match: ci("bureau of fire", "\\bBFP\\b"),
  },
  { label: "Commission on Audit", match: ci("commission on audit", "\\bCoA\\b", "\\bCOA\\b") },
  {
    label: "Department of Trade and Industry",
    match: ci("trade and industry", "\\bDTI\\b"),
  },
  {
    label: "Civil Service Commission",
    match: ci("civil service commission", "\\bCSC\\b"),
  },
  {
    label: "Department of Interior and Local Government",
    match: ci("interior and local government", "\\bDILG\\b"),
  },
  {
    label: "Public Order and Safety Office",
    match: ci("public order and safety", "\\bPOSO\\b"),
  },
  { label: "COMELEC", match: ci("comelec", "commission on election") },
  {
    label: "Bureau of Internal Revenue",
    match: ci("bureau of internal revenue", "\\bBIR\\b"),
  },
  { label: "Security", match: ci("security") },
  {
    label: "BPLO",
    match: ci("business permit", "\\bBPLO\\b"),
  },
  {
    label: "PESO",
    match: ci("public employment service", "\\bPESO\\b"),
  },
  {
    label: "BAC",
    match: ci("bids? and awards", "\\bBAC\\b"),
  },
];

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Sort items by a fixed label list (exact match after normalize).
 * Unknown labels keep relative alpha order after known ones.
 */
export function sortByLabelOrder<T>(
  items: T[],
  getLabel: (item: T) => string,
  order: readonly string[],
  options?: { keepTotalLast?: boolean }
): T[] {
  const keepTotalLast = options?.keepTotalLast ?? true;
  const rank = new Map(order.map((label, i) => [normalizeKey(label), i]));

  const scored = items.map((item, index) => {
    const label = getLabel(item);
    const key = normalizeKey(label);
    const isTotal = key === "total";
    const orderIdx = rank.has(key) ? rank.get(key)! : Number.POSITIVE_INFINITY;
    return { item, index, label, orderIdx, isTotal };
  });

  scored.sort((a, b) => {
    if (keepTotalLast && a.isTotal !== b.isTotal) return a.isTotal ? 1 : -1;
    if (a.orderIdx !== b.orderIdx) return a.orderIdx - b.orderIdx;
    const byName = a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
    if (byName !== 0) return byName;
    return a.index - b.index;
  });

  return scored.map((s) => s.item);
}

/**
 * Sort items using ANNEX_OFFICE_ORDER matchers.
 * Unmatched offices sort alphabetically after the canonical block.
 */
export function sortByAnnexOfficeOrder<T>(
  items: T[],
  getName: (item: T) => string,
  options?: { keepTotalLast?: boolean }
): T[] {
  const keepTotalLast = options?.keepTotalLast ?? true;

  const scored = items.map((item, index) => {
    const name = getName(item);
    const key = normalizeKey(name);
    const isTotal = key === "total";
    const orderIdx = isTotal
      ? Number.POSITIVE_INFINITY
      : ANNEX_OFFICE_ORDER.findIndex((rule) => rule.match(name));
    return {
      item,
      index,
      name,
      isTotal,
      orderIdx: orderIdx === -1 ? Number.POSITIVE_INFINITY : orderIdx,
    };
  });

  scored.sort((a, b) => {
    if (keepTotalLast && a.isTotal !== b.isTotal) return a.isTotal ? 1 : -1;
    if (a.orderIdx !== b.orderIdx) return a.orderIdx - b.orderIdx;
    const byName = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    if (byName !== 0) return byName;
    return a.index - b.index;
  });

  return scored.map((s) => s.item);
}
