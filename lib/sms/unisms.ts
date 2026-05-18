import axios from "axios";

type SendUniSmsInput = {
  recipient: string;
  content: string;
  senderId?: string | null;
  metadata?: Record<string, unknown>;
};

export type UniSmsResult = {
  ok: boolean;
  status: number | null;
  providerMessageId: string | null;
  responseBody: unknown;
  errorMessage: string | null;
};

function getUniSmsConfig() {
  const apiUrl = process.env.UNISMS_API_URL?.trim() || "https://unismsapi.com/api";
  const apiKey = process.env.UNISMS_API_KEY?.trim();
  const senderId = process.env.UNISMS_SENDER_ID?.trim();

  if (!apiKey) {
    throw new Error("UNISMS_API_KEY is not configured.");
  }

  return {
    apiUrl: apiUrl.replace(/\/+$/, ""),
    apiKey,
    senderId: senderId || undefined,
  };
}

export function getDefaultUniSmsSenderId() {
  return process.env.UNISMS_SENDER_ID?.trim() || "";
}

function readProviderMessageId(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const message = record.message;
  if (message && typeof message === "object") {
    const referenceId = (message as Record<string, unknown>).reference_id;
    if (typeof referenceId === "string" && referenceId.trim()) {
      return referenceId;
    }
  }

  const candidates = [
    record.id,
    record.reference_id,
    record.message_id,
    record.messageId,
    record.sms_id,
    record.smsId,
    record.uuid,
  ];

  const match = candidates.find((value) => typeof value === "string" || typeof value === "number");
  return match == null ? null : String(match);
}

function readErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      const message = record.message ?? record.error ?? record.detail;
      if (typeof message === "string" && message.trim()) {
        return message.trim();
      }
      if (message && typeof message === "object") {
        const nested = (message as Record<string, unknown>).fail_reason;
        if (typeof nested === "string" && nested.trim()) {
          return nested.trim();
        }
      }
      const errors = record.errors;
      if (errors && typeof errors === "object") {
        const parts = Object.entries(errors as Record<string, unknown>).flatMap(([field, value]) => {
          if (Array.isArray(value)) {
            return value.map((item) => `${field}: ${String(item)}`);
          }
          return [`${field}: ${String(value)}`];
        });
        if (parts.length > 0) {
          return parts.join("; ");
        }
      }
    }
    return error.message || "UniSMS request failed.";
  }

  return error instanceof Error ? error.message : "UniSMS request failed.";
}

export async function sendUniSms(input: SendUniSmsInput): Promise<UniSmsResult> {
  try {
    const config = getUniSmsConfig();
    const senderId = input.senderId?.trim() || config.senderId;
    const body = {
      recipient: input.recipient,
      content: input.content,
      ...(senderId ? { sender_id: senderId } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    };

    const response = await axios.post(`${config.apiUrl}/sms`, body, {
      auth: {
        username: config.apiKey,
        password: "",
      },
      timeout: 45000,
    });

    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      providerMessageId: readProviderMessageId(response.data),
      responseBody: response.data,
      errorMessage: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: axios.isAxiosError(error) ? error.response?.status ?? null : null,
      providerMessageId: null,
      responseBody: axios.isAxiosError(error) ? error.response?.data ?? null : null,
      errorMessage: readErrorMessage(error),
    };
  }
}
