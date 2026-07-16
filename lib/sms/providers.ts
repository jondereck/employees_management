import { isSmsGateConfigured, sendSmsGateSms } from "@/lib/sms/smsgate";
import { sendTwilioSms } from "@/lib/sms/twilio";
import { sendUniSms } from "@/lib/sms/unisms";
import type { SmsProviderName, SmsProviderResult, SmsSendInput } from "@/lib/sms/types";

const UNISMS_MAX_CONTENT_LENGTH = 160;

export const SMS_PROVIDER_NAMES = ["smsgate", "twilio", "unisms"] as const satisfies readonly SmsProviderName[];

export type SmsProviderSendResult = SmsProviderResult & {
  attempts: SmsProviderResult[];
};

function skippedResult(provider: SmsProviderName, reason: string): SmsProviderResult {
  return {
    ok: false,
    provider,
    status: null,
    providerMessageId: null,
    responseBody: null,
    errorMessage: reason,
    queued: false,
  };
}

export function isSmsProviderConfigured(provider: SmsProviderName): boolean {
  switch (provider) {
    case "smsgate":
      return isSmsGateConfigured();
    case "twilio":
      return Boolean(
        process.env.TWILIO_ACCOUNT_SID?.trim() &&
          process.env.TWILIO_AUTH_TOKEN?.trim() &&
          process.env.TWILIO_FROM_NUMBER?.trim()
      );
    case "unisms":
      return Boolean(process.env.UNISMS_API_KEY?.trim());
    default:
      return false;
  }
}

async function sendWithProvider(
  provider: SmsProviderName,
  input: SmsSendInput
): Promise<SmsProviderResult> {
  switch (provider) {
    case "smsgate":
      return sendSmsGateSms(input);
    case "twilio":
      return sendTwilioSms(input);
    case "unisms":
      if (input.content.length > UNISMS_MAX_CONTENT_LENGTH) {
        return skippedResult(
          "unisms",
          `UniSMS content limit is ${UNISMS_MAX_CONTENT_LENGTH} characters.`
        );
      }
      return sendUniSms(input);
    default: {
      const exhaustive: never = provider;
      return skippedResult(exhaustive, `Unknown SMS provider: ${String(provider)}`);
    }
  }
}

/**
 * Send via exactly one selected provider (no silent fallback chain).
 */
export async function sendSmsViaProviders(
  input: SmsSendInput,
  provider: SmsProviderName = "smsgate"
): Promise<SmsProviderSendResult> {
  if (!isSmsProviderConfigured(provider)) {
    const result = skippedResult(
      provider,
      `${provider} SMS credentials are not configured.`
    );
    return { ...result, attempts: [result] };
  }

  const result = await sendWithProvider(provider, input);
  return { ...result, attempts: [result] };
}
