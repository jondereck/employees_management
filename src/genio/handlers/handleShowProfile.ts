// src/genio/handlers/handleShowProfile.ts
import { streamReply } from "../utils";

export async function handleShowProfile(context: any) {
  if (!context?.focus?.id) {
    return streamReply(
      "Please ask about an employee first.",
      context,
      null
    );
  }

  return streamReply(
    "Here’s the employee profile.",
    context,
    context.focus.id
  );
}

