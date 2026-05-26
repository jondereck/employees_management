import { z } from "zod";

import { GenioContext } from "./context";
import { frontDeskResult, policyResult } from "./frontDesk";
import { getKnowledgeSnippet } from "./knowledgeAdapter";
import { getOpenAI } from "./openai";
import {
  GenioAnswerabilityClass,
  GenioBlockedReason,
  GenioIntentClass,
  GenioToolSelection,
  checkGenioPolicy,
  classifyLocalGenioRoute,
  deterministicGenioSelection,
} from "./router";
import {
  GENIO_OPENAI_TOOLS,
  GenioToolResult,
  executeRegisteredGenioTool,
} from "./toolRegistry";

type RunGenioInput = {
  departmentId: string;
  message: string;
  context: GenioContext;
  clientMeta?: {
    locale?: string;
    languageHint?: string;
  };
};

export type GenioRouteDecision = {
  intent: GenioIntentClass;
  selectedTool?: string;
  confidence: number;
  blockedReason?: GenioBlockedReason;
  fallbackReason?: string;
  answerabilityClass: GenioAnswerabilityClass;
  memoryUsed: boolean;
};

function safeJsonParse(value: string | undefined) {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function selectToolWithAI(message: string): Promise<GenioToolSelection | null> {
  const openai = getOpenAI();
  if (!openai) return null;

  const completion = await openai.chat.completions.create({
    model: process.env.GENIO_AI_MODEL || "gpt-4o-mini",
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "You are Genio, a read-only HRPS assistant router. Select exactly one whitelisted tool. Do not answer from memory or general knowledge. All factual answers must come from HRPS tools. If unsupported, use not_answerable. Never request/expose sensitive data and never perform write actions. Never produce SQL, Prisma filters, or raw database field names.",
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

function appendKnowledgeSnippet(result: GenioToolResult, message: string, toolName: string) {
  if (result.kind !== "text") return result;
  const snippet = getKnowledgeSnippet(message, toolName);
  if (!snippet) return result;
  return {
    ...result,
    reply: `${result.reply}\n\nInternal note (${snippet.title}): ${snippet.excerpt}`,
  };
}

function memoryWasUsed(context: GenioContext) {
  return Boolean(context?.lastResult || context?.resultContextId);
}

export async function runGenioV1({
  departmentId,
  message,
  context,
}: RunGenioInput): Promise<{ result: GenioToolResult; decision: GenioRouteDecision }> {
  const env = { departmentId, message, context };
  const memoryUsed = memoryWasUsed(context);
  const localRoute = classifyLocalGenioRoute(message, context);

  const frontDesk = frontDeskResult(localRoute.intent, message, context);
  if (frontDesk) {
    return {
      result: frontDesk,
      decision: {
        intent: localRoute.intent,
        confidence: localRoute.confidence,
        answerabilityClass: "answered",
        memoryUsed,
      },
    };
  }

  const unsupportedPolicy = policyResult(localRoute, message, context);
  if (unsupportedPolicy) {
    return {
      result: unsupportedPolicy,
      decision: {
        intent: localRoute.intent,
        selectedTool: "not_answerable",
        confidence: localRoute.confidence,
        blockedReason: localRoute.blockedReason,
        fallbackReason: localRoute.fallbackReason,
        answerabilityClass: localRoute.answerabilityClass,
        memoryUsed,
      },
    };
  }

  if (localRoute.intent === "policy_blocked") {
    const result = (await executeRegisteredGenioTool(
      "not_answerable",
      { reason: localRoute.blockedReason, missingData: localRoute.missingData },
      env
    )) as GenioToolResult;

    return {
      result,
      decision: {
        intent: "policy_blocked",
        selectedTool: "not_answerable",
        confidence: localRoute.confidence,
        blockedReason: localRoute.blockedReason,
        fallbackReason: localRoute.fallbackReason,
        answerabilityClass: "blocked",
        memoryUsed,
      },
    };
  }

  if (
    (localRoute.intent === "context_followup" || localRoute.intent === "hr_database_query") &&
    localRoute.selectedTool
  ) {
    const toolResult = await executeRegisteredGenioTool(
      localRoute.selectedTool,
      localRoute.args ?? {},
      env
    );

    if (toolResult) {
      return {
        result: appendKnowledgeSnippet(toolResult, message, localRoute.selectedTool),
        decision: {
          intent: localRoute.intent,
          selectedTool: localRoute.selectedTool,
          confidence: localRoute.confidence,
          answerabilityClass: toolResult.kind === "text" && localRoute.selectedTool === "not_answerable"
            ? "unsupported"
            : "answered",
          memoryUsed,
        },
      };
    }
  }

  try {
    const aiSelection = await selectToolWithAI(message);
    if (aiSelection) {
      const toolResult = await executeRegisteredGenioTool(aiSelection.name, aiSelection.args, env);
      if (toolResult) {
        const answerabilityClass =
          aiSelection.name === "not_answerable" ? localRoute.answerabilityClass : "answered";

        return {
          result: appendKnowledgeSnippet(toolResult, message, aiSelection.name),
          decision: {
            intent: aiSelection.name === "not_answerable" ? localRoute.intent : "hr_database_query",
            selectedTool: aiSelection.name,
            confidence: 0.72,
            fallbackReason: localRoute.fallbackReason,
            answerabilityClass,
            memoryUsed,
          },
        };
      }
    }
  } catch (error) {
    console.error("[GENIO_AI_ROUTER]", error);
  }

  const fallbackResult = (await executeRegisteredGenioTool(
    localRoute.selectedTool ?? "not_answerable",
    localRoute.args ?? { reason: "ambiguous_question" },
    env
  )) as GenioToolResult;

  return {
    result: fallbackResult,
    decision: {
      intent: localRoute.intent,
      selectedTool: localRoute.selectedTool ?? "not_answerable",
      confidence: localRoute.confidence,
      blockedReason: localRoute.blockedReason,
      fallbackReason: localRoute.fallbackReason,
      answerabilityClass: localRoute.answerabilityClass,
      memoryUsed,
    },
  };
}

export async function runGenio(input: RunGenioInput): Promise<GenioToolResult> {
  const { departmentId, message, context } = input;
  const env = { departmentId, message, context };
  const localRoute = classifyLocalGenioRoute(message, context);
  const frontDesk = frontDeskResult(localRoute.intent, message, context);
  if (frontDesk) return frontDesk;

  const policy = checkGenioPolicy(message);
  if (policy) {
    if (policy.intent === "unsupported") {
      const unsupported = policyResult(policy, message, context);
      if (unsupported) return unsupported;
    }

    return (await executeRegisteredGenioTool(
      "not_answerable",
      { reason: policy.blockedReason, missingData: policy.missingData },
      env
    )) as GenioToolResult;
  }

  const deterministic = deterministicGenioSelection(message, context);
  if (deterministic) {
    const result = await executeRegisteredGenioTool(deterministic.name, deterministic.args, env);
    if (result) return result;
  }

  try {
    const aiSelection = await selectToolWithAI(message);
    if (aiSelection) {
      const result = await executeRegisteredGenioTool(aiSelection.name, aiSelection.args, env);
      if (result) return result;
    }
  } catch (error) {
    console.error("[GENIO_AI_ROUTER_LEGACY]", error);
  }

  return (await executeRegisteredGenioTool(
    "not_answerable",
    { reason: "ambiguous_question" },
    env
  )) as GenioToolResult;
}

export const genioRequestSchema = z
  .object({
    message: z.string().trim().min(1).max(1000),
    context: z.unknown().optional().nullable(),
    clientMeta: z
      .object({
        locale: z.string().trim().min(1).max(64).optional(),
        languageHint: z.string().trim().min(1).max(64).optional(),
      })
      .strip()
      .optional(),
  })
  .strip();
