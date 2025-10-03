// utils/normalizeEducation.ts
export function normalizeEducationLines(input: string): string[] {
  const PLACEHOLDER = /^(-|none|n\/a|na|not applicable)$/i;

  // ❗ Keep excluding only basic education; UNDERGRAD is now INCLUDED
  const EXCLUDE_PATTERNS = [
    /\b(elementary|primary)\b/i,
    /\b(high\s*school|highschool)\b/i,
    /\b(junior\s*high|senior\s*high|jhs|shs)\b/i,
    /\b(secondary\s+education|basic\s+education)\b/i,
    /\b(grade\s*\d+|k\s*-\s*12|k12)\b/i,
  ];

  const ACRONYM_MAP: Record<string, string> = {
    // Masters
    MBA: "Master of Business Administration",
    MIT: "Master of Information Technology",
    MSIT: "Master of Science in Information Technology",
    MSc: "Master of Science",
    MS: "Master of Science",
    MA: "Master of Arts",
    MAEd: "Master of Arts in Education",
    MPA: "Master of Public Administration",
    MPM: "Master in Public Management",
    // Doctorate
    PhD: "Doctor of Philosophy",
    DBA: "Doctor of Business Administration",
    EdD: "Doctor of Education",
    // Bachelor (common)
    BSIT: "Bachelor of Science in Information Technology",
    BSCS: "Bachelor of Science in Computer Science",
    BSBA: "Bachelor of Science in Business Administration",
    BSA: "Bachelor of Science in Accountancy",
    BSECE: "Bachelor of Science in Electronics Engineering",
  };

  const SMALL_WORDS = new Set(["of", "in", "and", "for", "the", "on", "at", "to", "with", "by"]);

  const titleCase = (s: string) =>
    s
      .toLowerCase()
      .split(/\s+/)
      .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
      .join(" ");

  const cleanTypos = (s: string) =>
    s
      .replace(/\blin\b/gi, "in") // "BS lin" -> "BS in"
      .replace(/\s{2,}/g, " ")
      .replace(/\s*,\s*/g, ", ")
      .trim();

  function expandDegreeCore(s: string): string {
    const trimmed = s.trim();

    // Exact acronym (MBA, MIT, etc.)
    const exact = ACRONYM_MAP[trimmed.replace(/\./g, "") as keyof typeof ACRONYM_MAP];
    if (exact) return exact;

    // BS/BA patterns
    let m = /^BS\s+in\s+(.+)$/i.exec(trimmed);
    if (m) return `Bachelor of Science in ${titleCase(cleanTypos(m[1]))}`;

    m = /^BS\s+(.+)$/i.exec(trimmed);
    if (m) return `Bachelor of Science in ${titleCase(cleanTypos(m[1]))}`;

    m = /^BA\s+in\s+(.+)$/i.exec(trimmed);
    if (m) return `Bachelor of Arts in ${titleCase(cleanTypos(m[1]))}`;

    m = /^BA\s+(.+)$/i.exec(trimmed);
    if (m) return `Bachelor of Arts in ${titleCase(cleanTypos(m[1]))}`;

    // Embedded acronym at start: "MBA – Marketing"
    for (const key of Object.keys(ACRONYM_MAP)) {
      const re = new RegExp(`^${key}\\b`, "i");
      if (re.test(trimmed)) {
        return trimmed.replace(re, ACRONYM_MAP[key]).replace(/\s*-\s*/g, " – ");
      }
    }

    return titleCase(cleanTypos(trimmed));
  }

  // NEW: handle undergraduate markers and then expand the degree
  function expandDegreeWithUndergrad(s: string): string {
    let line = s.trim();

    // detect undergrad markers (start or anywhere)
    const hasUndergrad =
      /^\s*(under\s*grad(uate)?|college\s+undergraduate)\b/i.test(line) ||
      /\b\(?\s*under\s*grad(uate)?\s*\)?/i.test(line);

    // remove leading marker like "Undergraduate: " or "(Undergrad) "
    line = line
      .replace(/^\s*(under\s*grad(uate)?|college\s+undergraduate)\s*[:\-–]?\s*/i, "")
      .replace(/^\(\s*under\s*grad(uate)?\s*\)\s*/i, "");

    // expand degree normally
    const expanded = expandDegreeCore(line);

    // append tag if it was undergrad
    return hasUndergrad ? `${expanded} (Undergraduate)` : expanded;
  }

  const shouldExclude = (s: string) =>
    PLACEHOLDER.test(s) || EXCLUDE_PATTERNS.some((re) => re.test(s));

  // Split → clean → include Undergraduate → expand → dedupe
  const lines = (input ?? "")
    .split(/\r?\n|;|•|-{2,}/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !shouldExclude(s))
    .map(expandDegreeWithUndergrad);

  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of lines) {
    const key = line.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(line);
    }
  }
  return result;
}
