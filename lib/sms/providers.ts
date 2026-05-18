import { sendTwilioSms } from "@/lib/sms/twilio";
import { sendUniSms } from "@/lib/sms/unisms";
import type { SmsProviderResult, SmsSendInput } from "@/lib/sms/types";

const UNISMS_MAX_CONTENT_LENGTH = 160;

export type SmsProviderSendResult = SmsProviderResult & {
  attempts: SmsProviderResult[];
};

function fallbackSkippedResult(reason: string): SmsProviderResult {
  return {
    ok: false,
    provider: "unisms",
    status: null,
    providerMessageId: null,
    responseBody: null,
    errorMessage: reason,
    queued: false,
  };
}

export async function sendSmsViaProviders(input: SmsSendInput): Promise<SmsProviderSendResult> {
  const twilioResult = await sendTwilioSms(input);
  if (twilioResult.queued) {
    return { ...twilioResult, attempts: [twilioResult] };
  }

  if (input.content.length > UNISMS_MAX_CONTENT_LENGTH) {
    const skipped = fallbackSkippedResult(
      "Twilio failed before queueing. UniSMS fallback was skipped because UniSMS content limit is 160 characters."
    );
    return { ...twilioResult, attempts: [twilioResult, skipped] };
  }

  const unismsResult = await sendUniSms(input);
  return { ...unismsResult, attempts: [twilioResult, unismsResult] };
}
