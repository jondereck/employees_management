// utils/copyUtils.ts

export type CaseOption = "uppercase" | "sentence";

export function toSentenceCase(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function formatText(text: string, caseOption: CaseOption): string {
  if (caseOption === "uppercase") return text.toUpperCase();
  if (caseOption === "sentence") return toSentenceCase(text);
  return text;
}

export function composeCopyText(
  fields: Record<string, boolean>,
  data: Record<string, string>,
  caseOption: CaseOption
): string {
  const parts: string[] = [];

  for (const key in fields) {
    if (fields[key] && data[key]) {
      parts.push(formatText(data[key], caseOption));
    }
  }

  return parts.join(" | ");
}
