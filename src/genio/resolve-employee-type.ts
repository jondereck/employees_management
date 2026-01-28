// src/genio/resolve-employee-type.ts

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/employees?|employee|staff|workers?|officials?/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractEmployeeTypeKeyword(message: string) {
  let text = message.toLowerCase();

  // remove question phrases
  text = text.replace(/how many|count|number of|\?/gi, "");

  // remove employee words
  text = text.replace(/employees?|employee|staff|workers?/gi, "");

  // 🚫 remove gender words
  text = text.replace(
    /\b(male|men|man|female|women|woman|girls?|boys?)\b/gi,
    ""
  );

  // 🚫 remove office phrases
  text = text.replace(/\b(in|sa)\s+[a-z\s]+/gi, "");

  // normalize spaces
  text = text.replace(/\s+/g, " ").trim();

  return text;
}


export function resolveEmployeeType(
  keyword: string,
  employeeTypes: { id: string; name: string; value: string }[]
) {
  const normalized = normalize(keyword);

  if (!normalized) return null;

  // 1️⃣ Exact value match
  const exactValue = employeeTypes.find(
    (t) => normalize(t.value) === normalized
  );
  if (exactValue) return exactValue;

  // 2️⃣ Exact name match
  const exactName = employeeTypes.find(
    (t) => normalize(t.name) === normalized
  );
  if (exactName) return exactName;

  // 3️⃣ Alias matching
  const aliasMap: Record<string, string[]> = {
    permanent: ["permanent", "regular"],
    casual: ["casual"],
    contract: ["contract", "cos", "contract of service"],
    elected: ["elected", "elected employee", "elected official"],
    coterminous: ["coterm", "coterminous"],
    "job order": ["jo", "job order", "job-order"],
  };

  for (const type of employeeTypes) {
    const typeName = normalize(type.name);
    const typeValue = normalize(type.value);

    for (const aliases of Object.values(aliasMap)) {
      if (
        aliases.includes(normalized) &&
        (aliases.includes(typeName) || aliases.includes(typeValue))
      ) {
        return type;
      }
    }
  }

  return null;
}
