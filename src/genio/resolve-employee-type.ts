// src/genio/resolve-employee-type.ts

export function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/employees?|employee|staff|workers?|officials?/g, "")
    .replace(/[^a-z0-9]/g, "") // removes spaces, hyphens, symbols
    .trim();
}


const FALLBACK_ALIASES: Record<string, string[]> = {
  permanent: ["permanent", "regular"],
  casual: ["casual"],
  contractofservice: ["contract", "cos", "contract of service"],
  elected: ["elected", "elected employee", "elected official"],
  coterminous: ["coterm", "coterminous"],
  joborder: ["jo", "job order", "job-order"],
};



export function extractEmployeeTypeKeyword(
  message: string,
  employeeTypes: { name: string }[]
) {
  const normalizedMessage = normalize(message);

  for (const type of employeeTypes) {
    const normalizedType = normalize(type.name);

    if (normalizedMessage.includes(normalizedType)) {
      return normalizedType; // 🔧 return normalized token
    }
  }

  return null;
}



export function resolveEmployeeType(
  raw: string,
  employeeTypes: { id: string; name: string }[]
) {
  if (!raw) return null;

  const normalizedRaw = normalize(raw);

  /* ===============================
     1️⃣ PRIMARY: DB-driven match
     =============================== */
  for (const type of employeeTypes) {
    const normalizedName = normalize(type.name);

    if (normalizedRaw === normalizedName) {
      return type;
    }
    if (
      normalizedRaw === normalizedName ||
      normalizedRaw.startsWith(normalizedName)
    ) {
      return type;
    }

  }

  /* ===============================
     2️⃣ FALLBACK: alias match
     =============================== */
  for (const [canonical, aliases] of Object.entries(FALLBACK_ALIASES)) {
    const normalizedAliases = aliases.map(normalize);

if (normalizedAliases.some(a => normalizedRaw.includes(a))) {
  const match = employeeTypes.find(
    t => normalize(t.name) === canonical
  );
  if (match) return match;
}

  }

  return null;
}

