export const WORKFORCE_DEFAULT_INDICATORS = [
  "Clerical Services",
  "Health, Nutrition and Population Control",
  "IT Services",
  "Janitorial Services",
  "Security Services",
  "Social Services and Social Welfare",
  "Technical",
  "Trade and Crafts/Laborer",
  "Others",
] as const;

export const WORKFORCE_OTHERS_INDICATOR = "Others";

const WORKFORCE_CANONICAL_INDICATORS: Record<string, readonly string[]> = {
  "Clerical Services": ["clerical", "clerical services"],
  "Health, Nutrition and Population Control": [
    "health",
    "health nutrition and population control",
    "health, nutrition and population control",
  ],
  "IT Services": ["it service", "it services"],
  "Janitorial Services": ["janitor", "janitorial services"],
  "Security Services": ["security", "security services"],
  "Social Services and Social Welfare": [
    "social services and social welfare",
    "social services",
    "social welfare",
    "social welfare and development",
    "teacher",
    "education",
  ],
  Technical: ["technical"],
  "Trade and Crafts/Laborer": [
    "trade",
    "trade and crafts laborer",
    "trade and crafts/laborer",
    "crafts laborer",
    "crafts/laborer",
  ],
  Others: ["others", "other"],
};

export type WorkforceIndicatorSuggestion = {
  indicatorName: string;
  confidence: "high" | "medium" | "low";
  reason: string;
};

const INDICATOR_RULES: Array<{
  indicatorName: (typeof WORKFORCE_DEFAULT_INDICATORS)[number];
  keywords: string[];
  positionKeywords?: string[];
  fallbackKeywords?: string[];
  confidence: WorkforceIndicatorSuggestion["confidence"];
}> = [
  {
    indicatorName: "Health, Nutrition and Population Control",
    confidence: "high",
    positionKeywords: ["nurse", "midwife", "midwifery", "medical", "doctor", "dentist", "sanitary", "vaccinator"],
    fallbackKeywords: ["health", "rhu", "nutrition"],
    keywords: ["nurse", "midwife", "midwifery", "medical", "doctor", "dentist", "sanitary", "vaccinator", "health", "rhu", "nutrition"],
  },
  {
    indicatorName: "IT Services",
    confidence: "high",
    keywords: ["it ", "information technology", "programmer", "computer", "system", "network", "database", "technician"],
  },
  {
    indicatorName: "Security Services",
    confidence: "high",
    keywords: ["security", "guard", "traffic enforcer", "poso", "watchman"],
  },
  {
    indicatorName: "Social Services and Social Welfare",
    confidence: "high",
    fallbackKeywords: [
      "social worker",
      "social welfare",
      "social services",
      "welfare officer",
      "welfare aide",
      "mswdo",
      "teacher",
      "education",
    ],
    keywords: [
      "teacher",
      "day care",
      "daycare",
      "instructor",
      "educator",
      "teaching",
      "child development",
      "social worker",
      "social welfare",
      "social services",
      "welfare officer",
      "welfare aide",
      "mswdo",
    ],
  },
  {
    indicatorName: "Janitorial Services",
    confidence: "high",
    keywords: ["janitor", "utility", "cleaner", "maintenance worker", "street sweeper"],
  },
  {
    indicatorName: "Trade and Crafts/Laborer",
    confidence: "medium",
    keywords: ["driver", "operator", "mechanic", "electrician", "plumber", "carpenter", "mason", "welder", "laborer", "equipment"],
  },
  {
    indicatorName: "Technical",
    confidence: "medium",
    keywords: ["engineer", "architect", "planning", "draftsman", "surveyor", "technical", "inspector", "agriculturist", "environment"],
  },
  {
    indicatorName: "Clerical Services",
    confidence: "medium",
    keywords: ["encoder", "clerk", "clerical", "administrative aide", "administrative assistant", "admin", "secretary", "bookkeeper", "records", "processor"],
  },
];

const POSITION_OVERRIDE_RULES: Array<{
  indicatorName: (typeof WORKFORCE_DEFAULT_INDICATORS)[number];
  keywords: string[];
}> = [
  {
    indicatorName: "Clerical Services",
    keywords: ["encoder"],
  },
];

function normalizeClassifierText(value: string) {
  return ` ${value.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
}

export function normalizeIndicatorName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function getIndicatorCanonicalKey(value: string) {
  const normalized = normalizeIndicatorName(value);
  return (
    Object.entries(WORKFORCE_CANONICAL_INDICATORS).find(([, aliases]) =>
      aliases.some((alias) => normalizeIndicatorName(alias) === normalized)
    )?.[0] ?? null
  );
}

export function getCanonicalIndicatorLabel(value: string) {
  return getIndicatorCanonicalKey(value) ?? value;
}

export function suggestWorkforceIndicator(input: {
  position?: string | null;
  officeName?: string | null;
  employeeTypeName?: string | null;
}): WorkforceIndicatorSuggestion {
  const positionText = normalizeClassifierText(input.position ?? "");
  const officeAndTypeText = normalizeClassifierText(
    [input.officeName, input.employeeTypeName].filter(Boolean).join(" ")
  );

  for (const rule of POSITION_OVERRIDE_RULES) {
    const matched = rule.keywords.find((keyword) => positionText.includes(normalizeClassifierText(keyword)));
    if (matched) {
      return {
        indicatorName: rule.indicatorName,
        confidence: "high",
        reason: `RULE: Matched "${matched}" from position override rule.`,
      };
    }
  }

  for (const rule of INDICATOR_RULES) {
    const searchKeywords = rule.positionKeywords ?? rule.keywords;
    const matched = searchKeywords.find((keyword) => positionText.includes(normalizeClassifierText(keyword)));
    if (matched) {
      return {
        indicatorName: rule.indicatorName,
        confidence: rule.confidence,
        reason: `RULE: Matched "${matched}" from position text.`,
      };
    }
  }

  for (const rule of INDICATOR_RULES) {
    const searchKeywords = rule.fallbackKeywords ?? rule.keywords;
    const matched = searchKeywords.find((keyword) => officeAndTypeText.includes(normalizeClassifierText(keyword)));
    if (matched) {
      return {
        indicatorName: rule.indicatorName,
        confidence: rule.confidence === "high" ? "medium" : rule.confidence,
        reason: `RULE: Matched "${matched}" from office/type text.`,
      };
    }
  }

  return {
    indicatorName: WORKFORCE_OTHERS_INDICATOR,
    confidence: "low",
    reason: "RULE: No strong keyword match; needs admin review.",
  };
}
