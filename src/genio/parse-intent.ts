import OpenAI from "openai";
import { GenioIntent } from "./intent-schema";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function parseGenioIntent(
  message: string
): Promise<GenioIntent> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      {
        role: "system",
        content: `
You are an HR intent parser.
Return ONLY valid JSON matching this schema:

{
  "action": "count | list | profile | unknown",
  "filters": {
    "gender": "Male | Female | undefined",
    "employeeType": "string | undefined",
    "office": "string | undefined",
    "hired": "this_year | recent | any | undefined",
    "age": { "min": number, "max": number } | undefined
  }
}

Rules:
- Use "count" for "how many"
- Use "list" for "who are they", "show me"
- Use "profile" for "who is <name>"
- If unsure, use "unknown"
- DO NOT guess values
        `,
      },
      {
        role: "user",
        content: message,
      },
    ],
  });

  return JSON.parse(
    completion.choices[0].message.content || "{}"
  );
}
