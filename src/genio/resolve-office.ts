// src/genio/resolve-office.ts

import { OFFICE_ALIASES } from "./office-aliases";


function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/office/g, "")
    .replace(/[()']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveOffice(
  question: string,
  offices: { id: string; name: string }[]
) {
  const q = normalize(question);

  for (const office of offices) {
    const officeKey = normalize(office.name);

    // 1️⃣ Direct match
    if (q.includes(officeKey)) {
      return office;
    }

    // 2️⃣ Alias match
    const aliases = OFFICE_ALIASES[officeKey];
    if (aliases) {
      for (const alias of aliases) {
        if (q.includes(normalize(alias))) {
          return office;
        }
      }
    }
  }

  return null;
}
