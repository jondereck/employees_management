const TOOL_KEYS = [
  "biometrics",
  "covers",
  "attendance-import",
  "copy-options",
  "sg-range",
] as const;

export type ToolKey = (typeof TOOL_KEYS)[number];

const ADMIN_ROLES = new Set(["admin", "owner"]);

function normalizeToolKey(value: unknown): ToolKey | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return (TOOL_KEYS as readonly string[]).includes(normalized)
    ? (normalized as ToolKey)
    : null;
}

export type ToolAccessOptions = {
  metadata?: Record<string, unknown> | null;
  role?: string | null;
  isDepartmentOwner?: boolean;
};

export function extractToolAccess({
  metadata,
  role,
  isDepartmentOwner,
}: ToolAccessOptions = {}): Set<ToolKey> {
  if (role && ADMIN_ROLES.has(role.toLowerCase())) {
    return new Set(TOOL_KEYS);
  }

  if (isDepartmentOwner) {
    return new Set(TOOL_KEYS);
  }

  const allowed = new Set<ToolKey>();
  const meta = metadata ?? {};
  const rawList = Array.isArray((meta as any).toolAccess)
    ? (meta as any).toolAccess
    : Array.isArray((meta as any).allowedTools)
      ? (meta as any).allowedTools
      : null;

  if (rawList) {
    for (const entry of rawList) {
      const key = normalizeToolKey(entry);
      if (key) {
        allowed.add(key);
      }
    }
  }

  if (allowed.size > 0) {
    return allowed;
  }

  return new Set(TOOL_KEYS);
}

export function isToolKey(value: string): value is ToolKey {
  return (TOOL_KEYS as readonly string[]).includes(value);
}

export const ALL_TOOL_KEYS: ToolKey[] = [...TOOL_KEYS];
