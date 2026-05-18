import twilio from "twilio";

import type { SmsProviderResult, SmsSendInput } from "@/lib/sms/types";

function getTwilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim();

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error("Twilio SMS credentials are not configured.");
  }

  return { accountSid, authToken, fromNumber };
}

function readTwilioError(error: unknown) {
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const message = record.message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }

  return error instanceof Error ? error.message : "Twilio request failed.";
}

export function getTwilioWebhookBaseUrl() {
  return process.env.TWILIO_WEBHOOK_BASE_URL?.trim().replace(/\/+$/, "") || "";
}

export function getTwilioAuthToken() {
  return process.env.TWILIO_AUTH_TOKEN?.trim() || "";
}

export async function sendTwilioSms(input: SmsSendInput): Promise<SmsProviderResult> {
  try {
    const config = getTwilioConfig();
    const client = twilio(config.accountSid, config.authToken);
    const message = await client.messages.create({
      to: input.recipient,
      from: config.fromNumber,
      body: input.content,
      ...(input.statusCallbackUrl ? { statusCallback: input.statusCallbackUrl } : {}),
    });

    return {
      ok: true,
      provider: "twilio",
      status: message.status,
      providerMessageId: message.sid,
      responseBody: {
        sid: message.sid,
        status: message.status,
        to: message.to,
        from: message.from,
        numSegments: message.numSegments,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
      },
      errorMessage: null,
      queued: true,
    };
  } catch (error) {
    return {
      ok: false,
      provider: "twilio",
      status: error && typeof error === "object" ? String((error as Record<string, unknown>).status ?? "") || null : null,
      providerMessageId: null,
      responseBody: error && typeof error === "object" ? { ...error } : null,
      errorMessage: readTwilioError(error),
      queued: false,
    };
  }
}
