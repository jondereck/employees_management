import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function explainResult(
  summary: string,
  question: string
) {
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
