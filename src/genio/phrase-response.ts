import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

type PhraseInput = {
  type: "count" | "list" | "distribution";
  facts: Record<string, any>;
};

export async function phraseGenioResponse(
  input: PhraseInput
): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    messages: [
      {
        role: "system",
        content: `
You are an HR assistant.
Your task is to phrase responses naturally and professionally.

Rules:
- DO NOT invent facts
- DO NOT mention databases or systems
- Keep tone clear, friendly, and concise
- If appropriate, suggest a follow-up question
        `,
      },
      {
        role: "user",
        content: JSON.stringify(input),
      },
    ],
  });

  return (
    completion.choices[0].message.content ??
    "I have the information ready."
  );
}
