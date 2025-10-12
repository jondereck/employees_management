export function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((v) => typeof v === "string");
}

export function isSortLevel(x: unknown): x is { field: unknown; dir?: unknown } {
  return !!x && typeof (x as any).field === "string";
}

export function coerceDir(x: unknown): "asc" | "desc" {
  return x === "desc" ? "desc" : "asc";
}
