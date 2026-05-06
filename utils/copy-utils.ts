// utils/copyOptions.ts
export type Field = "fullName" | "position" | "office";
export type Format = "uppercase" | "lowercase" | "capitalize" | "toggle";

export interface CopyOptions {
  fields: Field[];
  format: Format;
}

const STORAGE_KEY = "copyOptions:v2";
const LEGACY_STORAGE_KEY = "copyOptions";

export const DEFAULT_COPY_OPTIONS: CopyOptions = {
  fields: ["fullName"],
  format: "capitalize",
};

// Load/save helpers (defensive against bad JSON)
export function loadCopyOptions(): CopyOptions {
  if (typeof window === "undefined") return DEFAULT_COPY_OPTIONS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return DEFAULT_COPY_OPTIONS;
    const parsed = JSON.parse(raw);
    if (!isCopyOptions(parsed)) return DEFAULT_COPY_OPTIONS;
    return parsed;
  } catch {
    return DEFAULT_COPY_OPTIONS;
  }
}

export function saveCopyOptions(opts: CopyOptions) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(opts));
}

function isCopyOptions(value: unknown): value is CopyOptions {
  if (!value || typeof value !== "object") return false;

  const fields = (value as CopyOptions).fields;
  const format = (value as CopyOptions).format;
  const validFields: Field[] = ["fullName", "position", "office"];
  const validFormats: Format[] = ["uppercase", "lowercase", "capitalize", "toggle"];

  return (
    Array.isArray(fields) &&
    fields.every((field) => validFields.includes(field)) &&
    validFormats.includes(format)
  );
}

/**
 * Smart Title Case:
 * - Lowercases minor words (unless first/last)
 * - Keeps words inside (...) but uppercases an all-caps acronym if detected like (Comelec) -> (COMELEC)
 * - Trims and compresses spaces
 */
export function smartTitleCase(input: string): string {
  const minor = new Set([
    "a","an","and","as","at","but","by","for","from","in","into","nor","of","on","onto","or","over","per","the","to","vs","via","with"
  ]);

  // Handle parentheticals separately, e.g. (Comelec) -> (COMELEC)
  // We'll split by parens and rejoin preserving them.
  const parts = input.split(/(\(.*?\))/g); // capture groups keep parens substrings
  const converted = parts.map((part) => {
    if (part.startsWith("(") && part.endsWith(")")) {
      // Inside parentheses: if looks like acronym letters, uppercase; else title-case normally
      const inner = part.slice(1, -1).trim();
      // If it's letters (and maybe dots/spaces) and < 12 chars, force uppercase as acronym
      const acronymish = /^[A-Za-z.\s]+$/.test(inner) && inner.length <= 12;
      return `(${acronymish ? inner.replace(/\s+/g, " ").toUpperCase() : basicTitleCase(inner, minor)})`;
    }
    return basicTitleCase(part, minor);
  });

  return converted.join("").replace(/\s+/g, " ").trim();
}

function basicTitleCase(text: string, minor: Set<string>): string {
  const romanNumeralPattern = /^(?=[MDCLXVI])M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i;
  const acronymPattern = /^[A-Z]{2,3}$/;
  const consonantHeavyAcronymPattern = /^[A-Z]{4,12}$/;
  const vowels = /[AEIOU]/;
  const words = text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ");

  return words
    .map((w, i) => {
      if (!w) return w;
      if (romanNumeralPattern.test(w)) return w.toUpperCase();

      const lower = w.toLowerCase();
      const isFirst = i === 0;
      const isLast = i === words.length - 1;

      // Keep tokens like O’Neil / O'Reilly / McDonald nicer
      const normalized = lower.replace(/^([a-z])/, (_, c) => c.toUpperCase())
                          .replace(/([-\u2019'][a-z])/g, (m) => m.toUpperCase());

      if (!isFirst && !isLast && minor.has(lower)) return lower; // keep minor lowercase
      // Preserve acronym-shaped tokens like GIS, LGU, HRMO, DOH, LDRRMO.
      if (
        w === w.toUpperCase() &&
        (acronymPattern.test(w) || (consonantHeavyAcronymPattern.test(w) && !vowels.test(w)))
      ) {
        return w;
      }
      return normalized;
    })
    .join(" ");
}

/**
 * Special sanitizer for office names only:
 * - Applies smartTitleCase but forces prepositions like "on" to lower when appropriate
 * - Ensures acronym in parentheses is fully UPPER, e.g. (Comelec) -> (COMELEC)
 */
export function sanitizeOfficeName(name: string): string {
  const s = smartTitleCase(name);
  // Keep abbreviations tight to the office name, e.g. Election(COMELEC).
  return s
    .replace(/\s+\(/g, "(")
    .replace(/\(\s+/g, "(")     // trim space right after "("
    .replace(/\s+\)/g, ")");    // trim space before ")"
}

/**
 * Applies the chosen Format to a text AFTER field-specific sanitizers run.
 * For "capitalize", we use smartTitleCase instead of naive Word Caps.
 */
export function applyGlobalFormat(text: string, format: Format): string {
  switch (format) {
    case "uppercase":
      return text.toUpperCase();
    case "lowercase":
      return text.toLowerCase();
    case "capitalize":
      return smartTitleCase(text);
    case "toggle":
      return text
        .split("")
        .map((ch, i) => (i % 2 === 0 ? ch.toUpperCase() : ch.toLowerCase()))
        .join("");
    default:
      return text;
  }
}

/**
 * Field-aware formatter: run field-specific cleanup first,
 * then apply global Format to the final joined string at the end.
 */
export function formatFieldValue(field: Field, value: string): string {
  if (!value) return "";

  // Field-specific rules
  if (field === "office") {
    // Example: "Commission On Election (Comelec)" -> "Commission on Election (COMELEC)"
    return sanitizeOfficeName(value);
  }

  // For names/positions, you might also prefer smart title case pre-normalization:
  // Keep acronyms intact (e.g., JO, LGU)
  // Slightly safer than lowercasing-then-capitalizing
  return smartTitleCase(value);
}

/**
 * Build preview string from selected fields.
 */
export function buildPreview(
  data: { fullName: string; position: string; office: string },
  options: CopyOptions
): string {
  const parts = options.fields.map((f) => formatFieldValue(f, data[f]));
  const joined = parts.join(", ");
  return applyGlobalFormat(joined, options.format);
}
