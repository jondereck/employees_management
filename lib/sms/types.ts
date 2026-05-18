export type SmsProviderName = "twilio" | "unisms";

export type SmsProviderResult = {
  ok: boolean;
  provider: SmsProviderName;
  status: number | string | null;
  providerMessageId: string | null;
  responseBody: unknown;
  errorMessage: string | null;
  queued: boolean;
};

export type SmsSendInput = {
  recipient: string;
  content: string;
  senderId?: string | null;
  metadata?: Record<string, unknown>;
  statusCallbackUrl?: string | null;
};
