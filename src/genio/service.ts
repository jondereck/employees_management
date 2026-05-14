import { z } from "zod";

import { getOpenAI } from "./openai";
import { parseGenioIntent } from "./parse-intent";
import { GenioContext } from "./context";
import {
  GENIO_OPENAI_TOOLS,
  GenioToolResult,
  executeRegisteredGenioTool,
} from "./toolRegistry";

const exportPattern = /\b(export|download|export to excel|export this|export results|save to excel|i-export)\b/i;
const listLastPattern =
  /\b(list them|show list|show them|show who|who are they|who are those|who are these|who is it|tell who are they|tell me who they are|can you tell who|sino sila|sino mga yan|sino mga iyon|sino siya|ipakita ang listahan)\b/i;
const showProfilePattern = /\b(show profile|open profile|view employee|ipakita ang profile)\b/i;
const writeActionPattern = /\b(delete|remove|update|edit|change|archive|restore|approve|reject|promote|demote|set salary|change salary|burahin|tanggalin|palitan|i-update|i-delete|i-archive|i-approve|i-reject)\b/i;
const sensitiveDataPattern = /\b(tin|gsis|philhealth|pag-?ibig|philsys|national id|contact number|phone|address|emergency contact)\b/i;
const attendanceUnavailablePattern = /\b(late|lates|lateness|absent|absence|undertime|overtime|attendance log|biometric logs?|laging late|palaging late|huli|absent)\b/i;

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
          "You are Genio, a read-only HRPS assistant router. Select exactly one tool. Do not answer from memory or general knowledge. All factual answers must come from HRPS database tools. If the database does not contain the required data, call not_answerable. Never request or expose sensitive government IDs, emergency contact details, private contact data, or address fields. Never perform create, update, delete, archive, restore, approve, reject, promote, or salary-change actions. For Filipino, Taglish, or English questions, infer the closest DB-backed HRPS tool.",
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

  if (writeActionPattern.test(text)) {
    return { name: "not_answerable", args: { reason: "write_action_not_allowed" } };
  }

  if (sensitiveDataPattern.test(text)) {
    return { name: "not_answerable", args: { reason: "sensitive_data_restricted" } };
  }

  if (attendanceUnavailablePattern.test(text)) {
    return {
      name: "not_answerable",
      args: {
        reason: "missing_database_field",
        missingData: "attendance log fields",
      },
    };
  }

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
    const result = await executeRegisteredGenioTool(deterministic.name, deterministic.args, env);
    if (result) return result;
  }

  let aiSelection: ToolSelection | null = null;
  try {
    aiSelection = await selectToolWithAI(message);
  } catch (error) {
    console.error("[GENIO_AI_ROUTER]", error);
  }

  if (aiSelection) {
    const result = await executeRegisteredGenioTool(aiSelection.name, aiSelection.args, env);
    if (result) return result;
  }

  const fallback = deterministicSelection(message, context);
  if (fallback) {
    const result = await executeRegisteredGenioTool(fallback.name, fallback.args, env);
    if (result) return result;
  }

  return executeRegisteredGenioTool(
    "not_answerable",
    { reason: "ambiguous_question" },
    env
  ) as Promise<GenioToolResult>;
}

export const genioRequestSchema = z
  .object({
    message: z.string().trim().min(1).max(1000),
    context: z.unknown().optional().nullable(),
  })
  .strip();
