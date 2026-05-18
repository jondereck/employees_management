import twilio from "twilio";

import { getTwilioAuthToken, getTwilioWebhookBaseUrl } from "@/lib/sms/twilio";

export function formDataToTwilioParams(formData: FormData) {
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (typeof value === "string") {
      params[key] = value;
    }
  });
  return params;
}

export function getTwilioWebhookUrl(req: Request) {
  const requestUrl = new URL(req.url);
  const configuredBaseUrl = getTwilioWebhookBaseUrl();
  if (!configuredBaseUrl) {
    return req.url;
  }

  return `${configuredBaseUrl}${requestUrl.pathname}${requestUrl.search}`;
}

export function validateTwilioWebhook(req: Request, params: Record<string, string>) {
  const authToken = getTwilioAuthToken();
  const signature = req.headers.get("x-twilio-signature") ?? "";

  if (!authToken || !signature) {
    return false;
  }

  return twilio.validateRequest(authToken, signature, getTwilioWebhookUrl(req), params);
}
