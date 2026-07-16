/**
 * SMSGate (sms-gate.app) — free open-source Android SMS gateway.
 *
 * Env:
 * - SMSGATE_USERNAME (required) — Cloud Server username from the Android app
 * - SMSGATE_PASSWORD (required) — Cloud Server password from the Android app
 * - SMSGATE_API_URL (optional) — default `https://api.sms-gate.app/3rdparty/v1`
 * - SMSGATE_SIM_NUMBER (optional) — 1-based SIM slot for dual-SIM phones (1 or 2)
 *
 * Docs: https://docs.sms-gate.app/getting-started/public-cloud-server/
 * Send: POST `{apiUrl}/messages` Basic auth, JSON `{ textMessage: { text }, phoneNumbers: [...] }`
 */
import axios from "axios";

import type { SmsProviderResult, SmsSendInput } from "@/lib/sms/types";

export type SmsGateResult = SmsProviderResult;

function getSmsGateConfig() {
  const apiUrl =
    process.env.SMSGATE_API_URL?.trim() || "https://api.sms-gate.app/3rdparty/v1";
  const username = process.env.SMSGATE_USERNAME?.trim();
  const password = process.env.SMSGATE_PASSWORD?.trim();
  const simNumberRaw = process.env.SMSGATE_SIM_NUMBER?.trim();

  if (!username || !password) {
    throw new Error("SMSGATE_USERNAME and SMSGATE_PASSWORD are not configured.");
  }

  let simNumber: number | undefined;
  if (simNumberRaw) {
    const parsed = Number.parseInt(simNumberRaw, 10);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 3) {
      simNumber = parsed;
    }
  }

  return {
    apiUrl: apiUrl.replace(/\/+$/, ""),
    username,
    password,
    simNumber,
  };
}

export function isSmsGateConfigured() {
  return Boolean(
    process.env.SMSGATE_USERNAME?.trim() && process.env.SMSGATE_PASSWORD?.trim()
  );
}

function readProviderMessageId(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const candidates = [record.id, record.messageId, record.message_id];
  const match = candidates.find((value) => typeof value === "string" || typeof value === "number");
  return match == null ? null : String(match);
}

function readErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === "string" && data.trim()) {
      return data.trim();
    }
    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      const message = record.message ?? record.error ?? record.detail;
      if (typeof message === "string" && message.trim()) {
        return message.trim();
      }
    }
    return error.message || "SMSGate request failed.";
  }

  return error instanceof Error ? error.message : "SMSGate request failed.";
}

export async function sendSmsGateSms(input: SmsSendInput): Promise<SmsGateResult> {
  try {
    const config = getSmsGateConfig();
    const body: Record<string, unknown> = {
      textMessage: { text: input.content },
      phoneNumbers: [input.recipient],
    };
    if (config.simNumber != null) {
      body.simNumber = config.simNumber;
    }

    const response = await axios.post(`${config.apiUrl}/messages`, body, {
      auth: {
        username: config.username,
        password: config.password,
      },
      headers: { "Content-Type": "application/json" },
      timeout: 45000,
      validateStatus: () => true,
    });

    const ok = response.status >= 200 && response.status < 300;
    if (!ok) {
      let errorMessage = `SMSGate failed with status ${response.status}.`;
      if (typeof response.data === "string" && response.data.trim()) {
        errorMessage = response.data.trim();
      } else if (response.data && typeof response.data === "object") {
        const record = response.data as Record<string, unknown>;
        const message = record.message ?? record.error ?? record.detail;
        if (typeof message === "string" && message.trim()) {
          errorMessage = message.trim();
        }
      }

      return {
        ok: false,
        provider: "smsgate",
        status: response.status,
        providerMessageId: null,
        responseBody: response.data,
        errorMessage,
        queued: false,
      };
    }

    return {
      ok: true,
      provider: "smsgate",
      status: response.status,
      providerMessageId: readProviderMessageId(response.data),
      responseBody: response.data,
      errorMessage: null,
      queued: true,
    };
  } catch (error) {
    return {
      ok: false,
      provider: "smsgate",
      status: axios.isAxiosError(error) ? error.response?.status ?? null : null,
      providerMessageId: null,
      responseBody: axios.isAxiosError(error) ? error.response?.data ?? null : null,
      errorMessage: readErrorMessage(error),
      queued: false,
    };
  }
}
