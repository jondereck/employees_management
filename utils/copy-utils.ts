// utils/copyOptions.ts
export type Field = "fullName" | "position" | "office";
export type Format = "uppercase" | "lowercase" | "capitalize" | "toggle";

export interface CopyOptions {
  fields: Field[];
  format: Format;
}

const STORAGE_KEY = "copyOptions:v2";

export const DEFAULT_COPY_OPTIONS: CopyOptions = {
  fields: ["fullName"],
  format: "capitalize",
};

// Load/save helpers (defensive against bad JSON)
export function loadCopyOptions(): CopyOptions {
  if (typeof window === "undefined") return DEFAULT_COPY_OPTIONS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_COPY_OPTIONS;
    const parsed = JSON.parse(raw);
    if (!parsed?.fields || !parsed?.format) return DEFAULT_COPY_OPTIONS;
    return parsed as CopyOptions;
  } catch {
    return DEFAULT_COPY_OPTIONS;
  }
}

export function saveCopyOptions(opts: CopyOptions) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(opts));
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
  const words = text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .split(" ");

  return words
    .map((w, i) => {
      if (!w) return w;
      const isFirst = i === 0;
      const isLast = i === words.length - 1;

      // Keep tokens like O’Neil / O'Reilly / McDonald nicer
      const normalized = w.replace(/^([a-z])/, (_, c) => c.toUpperCase())
                          .replace(/([-\u2019'][a-z])/g, (m) => m.toUpperCase());

      if (!isFirst && !isLast && minor.has(w)) return w; // keep minor lowercase
      // For things like LGU, HRMO, DOH -> keep as-is if already uppercase >= 2 chars
      if (w.length > 1 && w === w.toUpperCase()) return w;
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
  // ensure there's a space before "(" and no extra spaces inside the parens
  return s
    .replace(/(\S)\(/g, "$1 (") // ...Election(COMELEC) -> Election (COMELEC)
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
