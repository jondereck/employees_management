import OpenAI from "openai";
import { ChatCompletionMessageParam, ChatCompletionToolMessageParam } from "openai/resources/chat/completions";
import { streamReply } from "./utils";
import { getMemory, updateMemory } from "./context/genioMemory";
import { genioToolMap, GenioToolName } from "./tools/genioTools";
import { genioTools } from "./tools/toolDefinitions";

type GenioContext = Record<string, unknown>;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are Genio, the AI HR analytics assistant for the LGU HRPS system.

You help HR staff analyze employee data including:
- employee counts
- office comparisons
- age analysis
- workforce insights
- employee lists
- HR statistics

Rules:
- Always use tools when data is required.
- Never invent employee numbers.
- Only answer using real system data from tool responses.
- If a tool exists for a request, call it.
- Never expose credentials, API keys, internal configuration, stack traces, or server paths.
- Keep responses clear, structured, and concise.

When presenting results, use this style:
- Start with a short heading.
- Then add key metrics as bullets.`;

function sanitizeMessage(input: unknown): string {
  if (typeof input !== "string") {
    return "";
  }

  return input.trim().slice(0, 4000);
}

function sanitizeContext(input: unknown): GenioContext {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  return input as GenioContext;
}

function parseToolArguments(rawArguments: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(rawArguments) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function readTextResponse(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("text/plain") && !contentType.includes("application/json")) {
    return "Tool executed successfully.";
  }

  return response.text();
}

function getContextFromResponse(response: Response, fallback: GenioContext): GenioContext {
  const rawContext = response.headers.get("x-genio-context");

  if (!rawContext) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(rawContext) as unknown;
    return sanitizeContext(parsed);
  } catch {
    return fallback;
  }
}

export async function routeGenioMessage(messageInput: unknown, contextInput: unknown) {
  const message = sanitizeMessage(messageInput);

  if (!message) {
    return streamReply("Please provide a valid question.", {}, null);
  }

  let context = sanitizeContext(contextInput);
  const memory = getMemory(context);

  const memoryMessages: ChatCompletionMessageParam[] = memory
    .filter((item): item is { role: "user" | "assistant"; content: string } =>
      item.role === "user" || item.role === "assistant"
    )
    .map((item) => ({ role: item.role, content: item.content }));

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...memoryMessages,
    { role: "user", content: message },
  ];

  context = updateMemory(context, { role: "user", content: message });

  try {
    for (let toolIteration = 0; toolIteration < 4; toolIteration += 1) {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages,
        tools: genioTools,
        tool_choice: "auto",
      });

      const choice = completion.choices[0]?.message;

      if (!choice) {
        break;
      }

      messages.push(choice);

      const toolCalls = choice.tool_calls ?? [];

      if (toolCalls.length === 0) {
        const finalAnswer = choice.content?.trim() ||
          "Genio could not retrieve the requested data. Please try again or refine the question.";

        context = updateMemory(context, { role: "assistant", content: finalAnswer });

        return streamReply(finalAnswer, context, null);
      }

      for (const toolCall of toolCalls) {
        if (toolCall.type !== "function") {
          continue;
        }

        const toolName = toolCall.function.name as GenioToolName;
        const toolFn = genioToolMap[toolName];

        if (!toolFn) {
          const unavailableMessage = "Requested tool is unavailable.";
          const toolMessage: ChatCompletionToolMessageParam = {
            role: "tool",
            tool_call_id: toolCall.id,
            content: unavailableMessage,
          };
          messages.push(toolMessage);
          continue;
        }

        const args = parseToolArguments(toolCall.function.arguments);

        let toolResponse: Response;

        try {
          toolResponse = await toolFn(args, context, message);
        } catch {
          const errorMessage =
            "Genio could not retrieve the requested data. Please try again or refine the question.";
          const toolMessage: ChatCompletionToolMessageParam = {
            role: "tool",
            tool_call_id: toolCall.id,
            content: errorMessage,
          };
          messages.push(toolMessage);
          context = updateMemory(context, { role: "tool", content: `${toolName}: ${errorMessage}` });
          continue;
        }

        if (
          toolName === "exportEmployees" ||
          (toolResponse.headers.get("content-type") ?? "").includes(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          )
        ) {
          return toolResponse;
        }

        const toolText = await readTextResponse(toolResponse);
        context = getContextFromResponse(toolResponse, context);
        context = updateMemory(context, { role: "tool", content: `${toolName}: ${toolText}` });

        const toolMessage: ChatCompletionToolMessageParam = {
          role: "tool",
          tool_call_id: toolCall.id,
          content: toolText,
        };

        messages.push(toolMessage);
      }
    }
  } catch {
    return streamReply(
      "Genio could not retrieve the requested data. Please try again or refine the question.",
      context,
      null
    );
  }

  return streamReply(
    "Genio could not retrieve the requested data. Please try again or refine the question.",
    context,
    null
  );
}
