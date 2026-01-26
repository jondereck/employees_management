import OpenAI from "openai";
import { GenioAction } from "../type";
import { GENIO_ACTIONS } from "./actions";


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function classifyGenioIntent(
  message: string
): Promise<GenioAction> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      {
        role: "system",
        content: `
You are an intent classifier for an HR assistant.
Choose the SINGLE best action from this list:

${GENIO_ACTIONS.join(", ")}

Rules:
- Return ONLY valid JSON
- Do NOT explain
- Do NOT invent actions
- If unsure, return "unknown"
`,
      },
      {
        role: "user",
        content: message,
      },
    ],
    response_format: { type: "json_object" },
  });

  const result = JSON.parse(
    completion.choices[0].message.content || "{}"
  );

  return (
    GENIO_ACTIONS.includes(result.action)
      ? result.action
      : "unknown"
  );
}
