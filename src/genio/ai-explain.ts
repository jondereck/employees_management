import { getOpenAI } from "./openai";

export async function explainResult(
  summary: string,
  question: string
) {
  const openai = getOpenAI();
  if (!openai) return null;

  const prompt = `
You are Genio, an HR assistant.

You are given an OFFICIAL RESULT.
Do NOT change numbers.
Do NOT add names.
Do NOT infer new data.

Result:
${summary}

User Question:
${question}

Explain the result clearly.
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  return completion.choices[0].message.content;
}
