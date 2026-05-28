import { GENIO_NL_PATTERNS } from "./natural-language-map";
import { GenioAction, GenioIntent } from "./type";

type ParseContext = {
  lastResult?: {
    type?: string;
  };
};

type ParseOutput = { intent: GenioIntent; confidence: number };

const YEAR_PATTERN = /\b(19|20|21)\d{2}\b/;
const FOLLOW_UP_PATTERN = /\b(list them|show them|show list|who are they|who is it|who is that|who's that|whos that|sino sila|sino yan|sino iyon|sino yun|show that|export that)\b/i;
const WHO_IS_HEAD_PATTERN = /\b(who is the head of|sino ang head ng)\b/i;
const IS_HEAD_PATTERN = /^is\s+.+\s+the head of\s+.+/i;

function normalizeText(message: string) {
  return message
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s,.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractGender(text: string): "Male" | "Female" | undefined {
  if (/\b(female|women|woman|babae)\b/i.test(text)) return "Female";
  if (/\b(male|men|man|lalaki)\b/i.test(text)) return "Male";
  return undefined;
}

function extractAge(text: string) {
  const range =
    text.match(/\bbetween\s+(\d{1,3})\s*(?:-|to|and)\s*(\d{1,3})\b/) ||
    text.match(/\b(\d{1,3})\s*(?:-|to|and)\s*(\d{1,3})\s*(?:age|years?|yrs?|old)?\b/);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    if (Number.isFinite(min) && Number.isFinite(max)) {
      return { min: Math.min(min, max), max: Math.max(min, max) };
    }
  }

  const exact =
    text.match(/\b(?:age|aged)\s*(\d{1,3})\b/) ||
    text.match(/\b(\d{1,3})\s*(?:years?\s*old|yrs?\s*old)\b/);
  if (exact) return { exact: Number(exact[1]) };

  const above = text.match(/\b(?:above|older than|over|more than)\s*(\d{1,3})\b/);
  if (above) return { min: Number(above[1]) };

  const below = text.match(/\b(?:below|younger than|under|less than)\s*(\d{1,3})\b/);
  if (below) return { max: Number(below[1]) };

  return undefined;
}

function extractTenure(text: string) {
  const range =
    text.match(/\btenure\s+(\d{1,2})\s*(?:-|to|and)\s*(\d{1,2})\b/) ||
    text.match(/\b(\d{1,2})\s*(?:-|to|and)\s*(\d{1,2})\s*years?\s*(?:of service|tenure)?\b/);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    return { min: Math.min(min, max), max: Math.max(min, max) };
  }

  const above = text.match(/\b(?:above|over|more than)\s*(\d{1,2})\s*years?\b/);
  if (above) return { min: Number(above[1]) };

  const below = text.match(/\b(?:below|under|less than)\s*(\d{1,2})\s*years?\b/);
  if (below) return { max: Number(below[1]) };

  return undefined;
}

function findMappedAction(text: string): GenioAction | null {
  for (const entry of GENIO_NL_PATTERNS) {
    for (const phrase of entry.patterns) {
      if (text.includes(phrase.toLowerCase())) return entry.action;
    }
  }
  return null;
}

export function parseGenioIntent(message: string, context?: ParseContext): ParseOutput {
  const text = normalizeText(message);
  const baseIntent: GenioIntent = { action: "unknown", filters: {} };

  if (!text) return { intent: baseIntent, confidence: 0 };

  if (FOLLOW_UP_PATTERN.test(text) && context?.lastResult?.type) {
    return {
      intent: { action: /export/.test(text) ? "export" : "list_from_last_count", filters: {}, followUp: true },
      confidence: 0.92,
    };
  }

  if (WHO_IS_HEAD_PATTERN.test(text)) return { intent: { action: "who_is_head", filters: {} }, confidence: 0.9 };
  if (IS_HEAD_PATTERN.test(message)) return { intent: { action: "is_head", filters: {} }, confidence: 0.9 };

  if (/\b(age distribution|age breakdown|age demographics|age percentile)\b/i.test(text)) {
    return { intent: { action: "age_distribution", filters: {} }, confidence: 0.9 };
  }

  if (/\b(award|awards|recognition|parangal)\b/i.test(text)) {
    return { intent: { action: "insight", filters: {} }, confidence: 0.55 };
  }

  if (/\b(employment event|promoted|promotion|transferred|terminated|hired|timeline)\b/i.test(text)) {
    return { intent: { action: "insight", filters: {} }, confidence: 0.55 };
  }

  if (/\b(schedule|weekly exclusion|work schedule|rotating|exception)\b/i.test(text)) {
    return { intent: { action: "insight", filters: {} }, confidence: 0.55 };
  }

  if (/\b(current|active)\b/.test(text) && /\b(employee|employees|staff)\b/.test(text)) {
    const year = text.match(YEAR_PATTERN)?.[0];
    return {
      intent: {
        action: "current_employees_by_year",
        filters: year ? { year: Number(year) } : {},
      },
      confidence: 0.86,
    };
  }

  const age = extractAge(text);
  if (age) return { intent: { action: "age_analysis", filters: { age, gender: extractGender(text) } }, confidence: 0.8 };

  const tenure = extractTenure(text);
  if (tenure) return { intent: { action: "tenure_analysis", filters: { tenure, gender: extractGender(text) } }, confidence: 0.8 };

  const prefixMatch =
    text.match(/starting with\s*(\d{2,})/) ||
    text.match(/\bbio\s*(\d{2,})/) ||
    text.match(/\b(\d{4,})\b/);
  if (prefixMatch?.[1]) {
    return {
      intent: { action: "describe_employee", filters: { employeeNoPrefix: prefixMatch[1] } },
      confidence: 0.86,
    };
  }

  if (text.startsWith("who is") || text.startsWith("sino si") || text.startsWith("tell me about")) {
    return {
      intent: { action: "describe_employee", target: "employee", filters: { name: message.replace(/^who is\s*/i, "").trim() } },
      confidence: 0.78,
    };
  }

  const mapped = findMappedAction(text);
  if (mapped) return { intent: { action: mapped, filters: {} }, confidence: 0.68 };

  return { intent: baseIntent, confidence: 0.2 };
}
