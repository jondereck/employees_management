import { SmsLogStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { formDataToTwilioParams, validateTwilioWebhook } from "@/lib/sms/twilio-webhook";

function mapTwilioStatus(status: string | undefined) {
  switch ((status ?? "").toLowerCase()) {
    case "queued":
    case "accepted":
    case "scheduled":
      return SmsLogStatus.QUEUED;
    case "sent":
    case "sending":
      return SmsLogStatus.SENT;
    case "delivered":
      return SmsLogStatus.DELIVERED;
    case "undelivered":
      return SmsLogStatus.UNDELIVERED;
    case "failed":
      return SmsLogStatus.FAILED;
    default:
      return null;
  }
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const params = formDataToTwilioParams(formData);

  if (!validateTwilioWebhook(req, params)) {
    return NextResponse.json({ error: "Invalid Twilio signature." }, { status: 403 });
  }

  const messageSid = params.MessageSid || params.SmsSid;
  const mappedStatus = mapTwilioStatus(params.MessageStatus || params.SmsStatus);
  if (!messageSid || !mappedStatus) {
    return new NextResponse(null, { status: 204 });
  }

  await prismadb.smsLog.updateMany({
    where: {
      provider: "twilio",
      providerMessageId: messageSid,
    },
    data: {
      status: mappedStatus,
      errorMessage: params.ErrorMessage || params.ErrorCode || null,
      responseBody: params,
    },
  });

  return new NextResponse(null, { status: 204 });
}
