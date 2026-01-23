// src/genio/resolve-employee-type.ts

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/employees?|staff|worker/g, "")
    .trim();
}

export function resolveEmployeeType(
  keyword: string,
  employeeTypes: { id: string; name: string; value: string }[]
) {
  const normalized = normalize(keyword);

  // 1️⃣ EXACT value match (highest priority)
  const exactValue = employeeTypes.find(
    (t) => normalize(t.value) === normalized
  );
  if (exactValue) return exactValue;

  // 2️⃣ EXACT name match
  const exactName = employeeTypes.find(
    (t) => normalize(t.name) === normalized
  );
  if (exactName) return exactName;

  // 3️⃣ Alias-style fallback (controlled)
  const aliasMap: Record<string, string[]> = {
    casual: ["casual"],
    permanent: ["permanent", "regular"],
    contract: ["contract", "cos", "contract of service"],
  };

  for (const type of employeeTypes) {
    const aliases = aliasMap[normalized];
    if (!aliases) continue;

    for (const alias of aliases) {
      if (
        normalize(type.name) === alias ||
        normalize(type.value) === alias
      ) {
        return type;
      }
    }
  }

  return null;
}
