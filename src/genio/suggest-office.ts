import { OFFICE_ALIASES } from "./office-aliases";

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/office|of|the|department|division|&/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// simple similarity score
function scoreMatch(input: string, target: string) {
  let score = 0;

  if (target.includes(input)) score += 3;
  if (input.includes(target)) score += 2;

  const inputWords = input.split(" ");
  const targetWords = target.split(" ");

  for (const w of inputWords) {
    if (targetWords.includes(w)) score += 1;
  }

  return score;
}

export function suggestOffices(
  message: string,
  offices: { id: string; name: string }[],
  limit = 3
) {
  const q = normalize(message);

  const scored = offices.map((office) => {
    const officeNorm = normalize(office.name);

    let bestScore = scoreMatch(q, officeNorm);

    // include aliases in scoring
    const aliases =
      OFFICE_ALIASES[officeNorm] ?? [];

    for (const alias of aliases) {
      bestScore = Math.max(
        bestScore,
        scoreMatch(q, normalize(alias))
      );
    }

    return {
      office,
      score: bestScore,
    };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.office);
}
