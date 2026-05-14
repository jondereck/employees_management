import { z } from "zod";

import { getOpenAI } from "./openai";
import { parseGenioIntent } from "./parse-intent";
import { GenioContext } from "./context";
import {
  executeGenioTool,
  GENIO_OPENAI_TOOLS,
  GenioToolResult,
} from "./tools";

const exportPattern = /\b(export|download|export to excel|export this|export results|save to excel|i-export)\b/i;
const listLastPattern =
  /\b(list them|show list|show them|show who|who are they|who are those|who are these|who is it|tell who are they|tell me who they are|can you tell who|sino sila|sino mga yan|sino mga iyon|sino siya|ipakita ang listahan)\b/i;
const showProfilePattern = /\b(show profile|open profile|view employee|ipakita ang profile)\b/i;

type RunGenioInput = {
  departmentId: string;
  message: string;
  context: GenioContext;
};

type ToolSelection = {
  name: string;
  args: unknown;
};

function safeJsonParse(value: string | undefined) {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function normalizeMessage(message: string) {
  return message.toLowerCase().replace(/[^\w\s,.-]/g, " ").replace(/\s+/g, " ").trim();
}

function extractGender(message: string) {
  if (/\b(female|women|woman|babae)\b/i.test(message)) return "Female";
  if (/\b(male|men|man|lalaki)\b/i.test(message)) return "Male";
  return undefined;
}

function extractAge(message: string) {
  const text = message.toLowerCase().replace(/[–—]/g, "-");
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

async function selectToolWithAI(message: string): Promise<ToolSelection | null> {
  const openai = getOpenAI();
  if (!openai) return null;

  const completion = await openai.chat.completions.create({
    model: process.env.GENIO_AI_MODEL || "gpt-4o-mini",
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "You are Genio, an HR assistant router. Select exactly one tool for employee, office, count, comparison, age, tenure, export, and current-year questions. Use tools only; do not answer from memory. The user may use English, Tagalog, or Taglish.",
      },
      { role: "user", content: message },
    ],
    tools: [...GENIO_OPENAI_TOOLS],
    tool_choice: "auto",
  });

  const call = completion.choices[0]?.message.tool_calls?.[0];
  if (!call || call.type !== "function") return null;

  return {
    name: call.function.name,
    args: safeJsonParse(call.function.arguments),
  };
}

function deterministicSelection(
  message: string,
  context: GenioContext
): ToolSelection | null {
  const text = normalizeMessage(message);

  if (exportPattern.test(text)) {
    return { name: "export_last_result", args: {} };
  }

  if (showProfilePattern.test(text)) {
    return { name: "show_profile", args: {} };
  }

  if (listLastPattern.test(text)) {
    return { name: "list_last_result", args: {} };
  }

  if (/\b(age distribution|age breakdown|age percentile|age demographics)\b/i.test(text)) {
    return { name: "age_distribution", args: {} };
  }

  if (/\b(by office|per office|office breakdown|distribution by office|office distribution)\b/i.test(text)) {
    return {
      name: "office_distribution",
      args: {
        gender: extractGender(text),
        age: extractAge(text),
      },
    };
  }

  if (/\b(oldest|pinaka\s*matanda|pinakamatanda)\b/i.test(text)) {
    return { name: "employee_extreme", args: { metric: "oldest" } };
  }

  if (/\b(youngest|pinaka\s*bata|pinakabata)\b/i.test(text)) {
    return { name: "employee_extreme", args: { metric: "youngest" } };
  }

  if (
    /\b(longest\s+(tenure|service)|most\s+senior|pinaka\s*matagal|pinakamatagal|matagal\s+sa\s+serbisyo)\b/i.test(
      text
    )
  ) {
    return { name: "employee_extreme", args: { metric: "longest_tenure" } };
  }

  if (/\b(newest\s+(hire|employee)|latest\s+(hire|employee)|recent\s+hire)\b/i.test(text)) {
    return { name: "employee_extreme", args: { metric: "newest_hire" } };
  }

  const isHeadMatch = message.match(/^is\s+(.+?)\s+the\s+head\s+of\s+(.+?)\??$/i);
  if (isHeadMatch) {
    return {
      name: "check_office_head",
      args: {
        employeeName: isHeadMatch[1],
        office: isHeadMatch[2],
      },
    };
  }

  const { intent } = parseGenioIntent(message, context);

  switch (intent.action) {
    case "describe_employee":
      return {
        name: "lookup_employees",
        args: {
          query: intent.filters.name || message,
          employeeNoPrefix: intent.filters.employeeNoPrefix,
          noteKeywords: intent.filters.note
            ? intent.filters.note.split(",").map((item) => item.trim()).filter(Boolean)
            : undefined,
        },
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
    case "is_head":
      return null;
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
      return {
        name: "age_analysis",
        args: {
          age: intent.filters.age,
          gender: intent.filters.gender,
        },
      };
    case "tenure_analysis":
      return {
        name: "tenure_analysis",
        args: {
          tenure: intent.filters.tenure,
          gender: intent.filters.gender,
        },
      };
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

export async function runGenio({
  departmentId,
  message,
  context,
}: RunGenioInput): Promise<GenioToolResult> {
  const env = { departmentId, message, context };
  const deterministic = deterministicSelection(message, context);

  if (deterministic) {
    const result = await executeGenioTool(deterministic.name, deterministic.args, env);
    if (result) return result;
  }

  let aiSelection: ToolSelection | null = null;
  try {
    aiSelection = await selectToolWithAI(message);
  } catch (error) {
    console.error("[GENIO_AI_ROUTER]", error);
  }

  if (aiSelection) {
    const result = await executeGenioTool(aiSelection.name, aiSelection.args, env);
    if (result) return result;
  }

  const fallback = deterministicSelection(message, context);
  if (fallback) {
    const result = await executeGenioTool(fallback.name, fallback.args, env);
    if (result) return result;
  }

  return {
    kind: "text",
    reply:
      "I can help with employee lookup, offices, counts, gender distribution, age, tenure, current employees by year, comparisons, and Excel export. Please ask one HR data question.",
    context,
  };
}

export const genioRequestSchema = z
  .object({
    message: z.string().trim().min(1).max(1000),
    context: z.unknown().optional().nullable(),
  })
  .strip();
