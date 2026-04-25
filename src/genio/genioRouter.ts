import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { addGenioMemory, getGenioMemory } from "./context/genioMemory";
import { genioToolMap, type GenioToolContext, type GenioToolName } from "./tools/genioTools";
import { genioTools } from "./tools/toolDefinitions";

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
- Only answer using real system data.
- If a tool exists for a request, call it.
- Never expose database credentials, API keys, system configuration, or server paths.
- Keep answers clear and concise.

Formatting:
- Use readable headings and short bullet points where appropriate.
- Example heading format: "Employee Count Summary".`;

type RouterInput = {
  message: string;
  context: GenioToolContext;
};

type ToolExecutionResult = {
  response: Response;
  text: string;
  context: GenioToolContext;
};

function sanitizeUserMessage(message: unknown): string {
  if (typeof message !== "string") {
    throw new Error("Invalid message payload.");
  }

  const trimmed = message.trim();
  if (!trimmed) {
    throw new Error("Message cannot be empty.");
  }

  return trimmed.slice(0, 1500);
}

function sanitizeContext(context: unknown): GenioToolContext {
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    return {};
  }

  return context as GenioToolContext;
}

async function responseToText(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")) {
    return "Export generated successfully.";
  }

  return response.text();
}

function extractContext(response: Response, fallback: GenioToolContext): GenioToolContext {
  const header = response.headers.get("x-genio-context");
  if (!header) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(header);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as GenioToolContext;
    }
  } catch {
    return fallback;
  }

  return fallback;
}

async function executeTool(params: {
  toolName: string;
  argsText: string;
  context: GenioToolContext;
  userMessage: string;
}): Promise<ToolExecutionResult> {
  const executor = genioToolMap[params.toolName as GenioToolName];

  if (!executor) {
    throw new Error(`Unsupported tool: ${params.toolName}`);
  }

  const parsedArgs = params.argsText ? JSON.parse(params.argsText) : {};
  const args = parsedArgs && typeof parsedArgs === "object" ? parsedArgs : {};

  const response = await executor({
    args: args as Record<string, unknown>,
    context: params.context,
    userMessage: params.userMessage,
  });

  const text = await responseToText(response);
  const nextContext = extractContext(response, params.context);

  return {
    response,
    text,
    context: nextContext,
  };
}

export async function routeGenioMessage(input: RouterInput): Promise<Response> {
  const userMessage = sanitizeUserMessage(input.message);
  let context = sanitizeContext(input.context);

  const memoryMessages: ChatCompletionMessageParam[] = getGenioMemory().map((item) => {
    if (item.role === "user") {
      return { role: "user", content: item.content };
    }

    return {
      role: "assistant",
      content: item.role === "tool" ? `Tool context: ${item.content}` : item.content,
    };
  });

  const initialMessages: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...memoryMessages,
    { role: "user", content: userMessage },
  ];

  addGenioMemory({ role: "user", content: userMessage });

  try {
    const firstPass = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: initialMessages,
      tools: genioTools,
      tool_choice: "auto",
      temperature: 0,
    });

    const firstMessage = firstPass.choices[0]?.message;

    if (!firstMessage) {
      throw new Error("No model response.");
    }

    if (!firstMessage.tool_calls || firstMessage.tool_calls.length === 0) {
      const fallback = firstMessage.content ?? "Genio could not retrieve the requested data. Please try again or refine the question.";
      addGenioMemory({ role: "assistant", content: fallback });
      return new Response(fallback, {
        headers: { "Content-Type": "text/plain", "x-genio-context": JSON.stringify(context) },
      });
    }

    const conversation: ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
      {
        role: "assistant",
        content: firstMessage.content ?? "",
        tool_calls: firstMessage.tool_calls,
      },
    ];

    for (const toolCall of firstMessage.tool_calls) {
      if (toolCall.type !== "function") {
        continue;
      }

      const toolResult = await executeTool({
        toolName: toolCall.function.name,
        argsText: toolCall.function.arguments,
        context,
        userMessage,
      });

      context = toolResult.context;

      const contentType = toolResult.response.headers.get("content-type") ?? "";
      if (contentType.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")) {
        return toolResult.response;
      }

      conversation.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: toolResult.text,
      });

      addGenioMemory({ role: "tool", content: `${toolCall.function.name}: ${toolResult.text}` });
    }

    const finalPass = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: conversation,
      temperature: 0.2,
    });

    const finalText = finalPass.choices[0]?.message?.content?.trim() ||
      "Genio could not retrieve the requested data. Please try again or refine the question.";

    addGenioMemory({ role: "assistant", content: finalText });

    return new Response(finalText, {
      headers: {
        "Content-Type": "text/plain",
        "x-genio-context": JSON.stringify(context),
      },
    });
  } catch {
    return new Response(
      "Genio could not retrieve the requested data. Please try again or refine the question.",
      {
        status: 500,
        headers: {
          "Content-Type": "text/plain",
          "x-genio-context": JSON.stringify(context),
        },
      }
    );
  }
}
