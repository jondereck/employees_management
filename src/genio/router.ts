import { GenioContext } from "./context";
import { parseGenioIntent } from "./parse-intent";

export type GenioIntentClass =
  | "small_talk"
  | "capability_help"
  | "policy_blocked"
  | "context_followup"
  | "hr_database_query"
  | "unsupported"
  | "clarification_needed";

export type GenioAnswerabilityClass =
  | "answered"
  | "disambiguation"
  | "blocked"
  | "unsupported";

export type GenioBlockedReason =
  | "write_action_not_allowed"
  | "sensitive_data_restricted"
  | "missing_database_field";

export type GenioToolSelection = {
  name: string;
  args: unknown;
};

export type LocalGenioRoute = {
  intent: GenioIntentClass;
  confidence: number;
  selectedTool?: string;
  args?: unknown;
  blockedReason?: GenioBlockedReason;
  missingData?: string;
  fallbackReason?: string;
  answerabilityClass: GenioAnswerabilityClass;
};

const writeActionPattern =
  /\b(delete|remove|update|edit|change|archive|restore|approve|reject|promote|demote|set salary|change salary|burahin|tanggalin|palitan|i-update|i-delete|i-archive|i-approve|i-reject|aprubahan)\b/i;
const sensitiveDataPattern =
  /\b(tin|gsis|philhealth|pag-?ibig|sss|philsys|national id|contact number|phone|address|emergency contact|mobile number|personal email)\b/i;
const attendanceUnavailablePattern =
  /\b(late|lates|lateness|absent|absence|undertime|overtime|attendance|attendance log|biometric logs?|tardy|time in|time out|laging late|palaging late|sino ang late|sino late|late employees|absent ngayon|huli)\b/i;
const smallTalkPattern = /^(hi|hello|hey|kumusta|kamusta|good morning|good afternoon|good evening)\b/i;
const capabilityPattern =
  /\b(help|what can you do|sample questions|examples?|capabilities|ano kaya mo|anong kaya mo|ano pwede|paano gamitin|tulong)\b/i;
const exportPattern =
  /\b(export|download|export to excel|export this|export that|export results|save to excel|i-export)\b/i;
const listLastPattern =
  /\b(list them|show list|show them|who are they|sino sila|sino siya|pakilista sila|ipakita ang listahan)\b/i;
const showProfilePattern =
  /\b(show profile|open profile|open the first one|open first one|view employee|ipakita ang profile)\b/i;

export function normalizeGenioMessage(message: string) {
  return message
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s,.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractGender(message: string) {
  if (/\b(female|women|woman|babae)\b/i.test(message)) return "Female";
  if (/\b(male|men|man|lalaki)\b/i.test(message)) return "Male";
  return undefined;
}

function extractAge(message: string) {
  const text = message.toLowerCase().replace(/[\u2013\u2014]/g, "-");
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

function hasPreviousContext(context: GenioContext) {
  return Boolean(context.lastResult || context.lastEmployeeId || context.resultContextId);
}

export function checkGenioPolicy(message: string): LocalGenioRoute | null {
  const text = normalizeGenioMessage(message);
  if (writeActionPattern.test(text)) {
    return {
      intent: "policy_blocked",
      confidence: 1,
      blockedReason: "write_action_not_allowed",
      fallbackReason: "write_action_not_allowed",
      answerabilityClass: "blocked",
    };
  }
  if (sensitiveDataPattern.test(text)) {
    return {
      intent: "policy_blocked",
      confidence: 1,
      blockedReason: "sensitive_data_restricted",
      fallbackReason: "sensitive_data_restricted",
      answerabilityClass: "blocked",
    };
  }
  if (attendanceUnavailablePattern.test(text)) {
    return {
      intent: "unsupported",
      confidence: 1,
      blockedReason: "missing_database_field",
      missingData: "attendance log model",
      fallbackReason: "missing_database_field",
      answerabilityClass: "unsupported",
    };
  }
  return null;
}

export function deterministicGenioSelection(
  message: string,
  context: GenioContext
): GenioToolSelection | null {
  const text = normalizeGenioMessage(message);

  if (exportPattern.test(text)) return { name: "export_last_result", args: {} };
  if (showProfilePattern.test(text)) return { name: "show_profile", args: {} };
  if (listLastPattern.test(text)) return { name: "list_last_result", args: {} };
  if (/\b(?:ilan|how many|count|total)\b/.test(text) && /\b(?:active )?(?:employee|employees|staff|empleyado)\b/.test(text) && !/\b(?:as of|noong|in|current in)\s+(?:19|20|21)\d{2}\b/.test(text)) {
    return { name: "count_employees", args: { gender: extractGender(text) } };
  }
  if (/\b(ilan babae|ilang babae|female count|count female|ilan ang babae|babae at lalaki)\b/i.test(text)) {
    return { name: "gender_distribution", args: {} };
  }
  if (/\b(ilan lalaki|ilang lalaki|male count|count male|ilan ang lalaki)\b/i.test(text)) {
    return { name: "gender_distribution", args: {} };
  }
  if (/\b(list all offices|list offices|lista ng offices|mga opisina)\b/i.test(text)) {
    return { name: "list_offices", args: {} };
  }
  if (/\b(list office heads|list heads|office heads|department heads|sino mga office head|mga hepe)\b/i.test(text)) {
    return { name: "list_office_heads", args: {} };
  }
  if (/\b(sino head ng|sino ang head ng|who is head of|who is the head of)\b/i.test(text)) {
    return { name: "who_is_office_head", args: { office: message } };
  }
  if (/\b(age distribution|age breakdown|age percentile|age demographics|age range)\b/i.test(text)) {
    return { name: "age_distribution", args: {} };
  }
  if (/\b(award|awards|recognition|awardee|awardees|parangal)\b/i.test(text)) {
    return { name: "award_analytics", args: {} };
  }
  if (/\b(employment event|timeline|promoted|promotion|transferred|reassigned|terminated|contract renewal|hired)\b/i.test(text)) {
    return { name: "employment_event_lookup", args: {} };
  }
  if (/\b(schedule|work schedule|custom schedule|office schedule|weekly exclusion|exception|rotating)\b/i.test(text)) {
    return { name: "schedule_metadata", args: {} };
  }
  if (/\b(history snapshot|workforce history|as of|active in \d{4}|current in \d{4})\b/i.test(text)) {
    const year = text.match(/\b(19|20|21)\d{2}\b/)?.[0];
    return { name: "history_snapshot", args: { year: year ? Number(year) : undefined } };
  }
  if (/\b(by office|per office|office breakdown|distribution by office|office distribution)\b/i.test(text)) {
    return { name: "office_distribution", args: { gender: extractGender(text), age: extractAge(text) } };
  }

  const { intent } = parseGenioIntent(message, context);
  switch (intent.action) {
    case "describe_employee":
      return {
        name: "lookup_employees",
        args: { query: intent.filters.name || message, employeeNoPrefix: intent.filters.employeeNoPrefix },
      };
    case "count":
      return {
        name: "count_employees",
        args: {
          gender: intent.filters.gender,
          employeeType: intent.filters.employeeType,
          office: intent.filters.office,
        },
      };
    case "list_offices":
      return { name: "list_offices", args: {} };
    case "list_heads":
      return { name: "list_office_heads", args: {} };
    case "who_is_head":
      return { name: "who_is_office_head", args: { office: intent.filters.office || message } };
    case "offices_no_head":
      return { name: "offices_without_head", args: {} };
    case "distribution":
      return { name: "gender_distribution", args: { office: intent.filters.office } };
    case "insight":
      return { name: "office_insight", args: { office: intent.filters.office || message } };
    case "compare_offices":
      return { name: "compare_offices", args: {} };
    case "compare_employee_types":
      return { name: "compare_employee_types", args: {} };
    case "top_offices":
      return { name: "top_offices", args: {} };
    case "smallest_office":
      return { name: "smallest_office", args: {} };
    case "age_analysis":
      return { name: "age_analysis", args: { age: intent.filters.age, gender: intent.filters.gender } };
    case "tenure_analysis":
      return { name: "tenure_analysis", args: { tenure: intent.filters.tenure, gender: intent.filters.gender } };
    case "current_employees_by_year":
      return { name: "current_employees_by_year", args: { year: intent.filters.year } };
    case "list_from_last_count":
    case "list":
      return { name: "list_last_result", args: {} };
    case "show_profile":
      return { name: "show_profile", args: {} };
    case "export":
      return { name: "export_last_result", args: {} };
    default:
      return null;
  }
}

export function classifyLocalGenioRoute(
  message: string,
  context: GenioContext = {}
): LocalGenioRoute {
  const text = normalizeGenioMessage(message);
  const policy = checkGenioPolicy(text);
  if (policy) return policy;

  if (smallTalkPattern.test(text) && text.split(/\s+/).length <= 4) {
    return {
      intent: "small_talk",
      confidence: 0.98,
      answerabilityClass: "answered",
    };
  }

  if (capabilityPattern.test(text)) {
    return {
      intent: "capability_help",
      confidence: 0.98,
      answerabilityClass: "answered",
    };
  }

  const followUp = exportPattern.test(text) || listLastPattern.test(text) || showProfilePattern.test(text);
  if (followUp && hasPreviousContext(context)) {
    const selection = deterministicGenioSelection(message, context);
    return {
      intent: "context_followup",
      confidence: 0.95,
      selectedTool: selection?.name,
      args: selection?.args ?? {},
      answerabilityClass: "answered",
    };
  }

  const selection = deterministicGenioSelection(message, context);
  if (selection) {
    return {
      intent: "hr_database_query",
      confidence: 0.86,
      selectedTool: selection.name,
      args: selection.args,
      answerabilityClass: "answered",
    };
  }

  if (text.split(/\s+/).length <= 4) {
    return {
      intent: "clarification_needed",
      confidence: 0.4,
      selectedTool: "not_answerable",
      args: {
        reason: "ambiguous_question",
        suggestedQuestions: [
          "How many active employees are there?",
          "List all offices.",
          "Show gender distribution.",
        ],
      },
      fallbackReason: "low_confidence_ambiguous",
      answerabilityClass: "disambiguation",
    };
  }

  return {
    intent: "clarification_needed",
    confidence: 0.4,
    selectedTool: "not_answerable",
    args: { reason: "outside_hrps_scope" },
    fallbackReason: "unsupported_scope",
    answerabilityClass: "unsupported",
  };
}
