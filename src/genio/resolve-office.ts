import { OFFICE_ALIASES } from "./office-aliases";

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/office|of|the|department|division|\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveOfficeWithAliases(
  question: string,
  offices: { id: string; name: string }[]
) {
  const q = normalize(question);

  for (const office of offices) {
    const officeNorm = normalize(office.name);

    // 1️⃣ Direct match
    if (q.includes(officeNorm)) {
      return office;
    }

    // 2️⃣ Alias match (FUZZY KEY MATCH)
    for (const [aliasKey, aliases] of Object.entries(OFFICE_ALIASES)) {
      if (officeNorm.includes(normalize(aliasKey))) {
        for (const alias of aliases) {
          if (q.includes(normalize(alias))) {
            return office;
          }
        }
      }
    }
  }

  return null;
}
