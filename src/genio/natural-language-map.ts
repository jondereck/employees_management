import { GenioAction } from "./type";


export const GENIO_NL_PATTERNS: {
  action: GenioAction;
  patterns: string[];
}[] = [
  /* ================= EMPLOYEE LOOKUP ================= */

  {
    action: "describe_employee",
    patterns: [
      "who is",
      "sino si",
      "tell me about",
      "impormasyon ni",
    ],
  },

  {
    action: "show_profile",
    patterns: [
      "show profile",
      "open profile",
      "ipakita ang profile",
      "view employee",
    ],
  },

  {
    action: "is_head",
    patterns: [
      "is head",
      "office head ba",
      "department head ba",
      "head ba si",
    ],
  },

  {
    action: "who_is_head",
    patterns: [
      "who is the head of",
      "sino ang head ng",
      "sino ang pinuno ng",
    ],
  },

  /* ================= OFFICE ================= */

  {
    action: "list_offices",
    patterns: [
      "list offices",
      "mga opisina",
      "anong opisina",
      "departments",
    ],
  },

  {
    action: "list_heads",
    patterns: [
      "list heads",
      "department heads",
      "mga hepe",
    ],
  },

  {
    action: "offices_no_head",
    patterns: [
      "offices without head",
      "walang head",
      "no department head",
    ],
  },

  {
    action: "top_offices",
    patterns: [
      "top offices",
      "largest office",
      "pinakamalaking opisina",
    ],
  },

  {
    action: "smallest_office",
    patterns: [
      "smallest office",
      "pinakamaliit na opisina",
    ],
  },

  /* ================= COUNTS ================= */

  {
    action: "count",
    patterns: [
      "how many employees",
      "ilan ang empleyado",
      "total employees",
      "employee count",
    ],
  },

  {
    action: "current_employees_by_year",
    patterns: [
      "current employees",
      "employees as of",
      "active employees",
      "empleyado noong",
      "as of year",
    ],
  },

  /* ================= ANALYTICS ================= */

  {
    action: "distribution",
    patterns: [
      "gender distribution",
      "ilan ang babae",
      "ilan ang lalaki",
    ],
  },

  {
    action: "age_analysis",
    patterns: [
      "how old",
      "age above",
      "below age",
      "edad",
    ],
  },

  {
    action: "tenure_analysis",
    patterns: [
      "years of service",
      "tenure",
      "ilang taon",
    ],
  },

  /* ================= COMPARISON ================= */

  {
    action: "compare_offices",
    patterns: [
      "compare offices",
      "vs",
      "comparison of",
    ],
  },

  {
    action: "compare_employee_types",
    patterns: [
      "compare employee types",
      "regular vs cos",
      "employee type comparison",
    ],
  },

  /* ================= UTILITY ================= */

  {
    action: "export",
    patterns: [
      "export",
      "download",
      "i-export",
      "save to excel",
    ],
  },

  {
    action: "list_from_last_count",
    patterns: [
      "list them",
      "show list",
      "ipakita ang listahan",
    ],
  },
];


export function matchNLPatterns(text: string): GenioAction | null {
  const lower = text.toLowerCase();

  for (const entry of GENIO_NL_PATTERNS) {
    for (const phrase of entry.patterns) {
      if (lower.includes(phrase)) {
        return entry.action;
      }
    }
  }

  return null;
}