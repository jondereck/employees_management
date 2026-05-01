import { streamReply } from "../utils";
import { getOpenAI } from "../openai";

export async function handleAIAnswer(
  message: string,
  context: any
) {
  const openai = getOpenAI();
  if (!openai) {
    return streamReply(
      "AI is not configured (missing OPENAI_API_KEY).",
      context,
      null
    );
  }

  const systemPrompt = `
You are Genio, an HR assistant.
You answer questions based on employee data context.
If numbers are required, explain conceptually only.
Do not invent data.
Be concise and professional.
`;

  const contextSummary = `
Context:
- Office: ${context?.focus?.name ?? "All offices"}
- Last count: ${
    context?.lastCountQuery
      ? JSON.stringify(context.lastCountQuery)
      : "None"
  }
- Last distribution: ${
    context?.lastDistributionQuery
      ? JSON.stringify(context.lastDistributionQuery)
      : "None"
  }
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "system", content: contextSummary },
      { role: "user", content: message },
    ],
  });

  const answer =
    completion.choices[0]?.message?.content ??
    "I couldn’t generate an answer.";

  return streamReply(answer, context, null);
}
