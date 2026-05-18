import { NextResponse } from "next/server";

import { normalizePhilippineMobileNumber } from "@/lib/phone";
import prismadb from "@/lib/prismadb";
import { formDataToTwilioParams, validateTwilioWebhook } from "@/lib/sms/twilio-webhook";

export async function POST(req: Request) {
  const formData = await req.formData();
  const params = formDataToTwilioParams(formData);

  if (!validateTwilioWebhook(req, params)) {
    return NextResponse.json({ error: "Invalid Twilio signature." }, { status: 403 });
  }

  const from = params.From ?? "";
  const normalizedFrom = normalizePhilippineMobileNumber(from);
  const phoneNumber = normalizedFrom.ok ? normalizedFrom.value : from;
  const message = (params.Body ?? "").trim();
  const providerMessageId = params.MessageSid || params.SmsSid || null;

  if (!phoneNumber || !message) {
    return new NextResponse(null, { status: 204 });
  }

  const latestOutbound = await prismadb.smsLog.findFirst({
    where: { phoneNumber },
    orderBy: { createdAt: "desc" },
    select: { departmentId: true, employeeId: true },
  });

  await prismadb.smsInboundMessage.upsert({
    where: { providerMessageId: providerMessageId ?? `missing-${Date.now()}` },
    create: {
      departmentId: latestOutbound?.departmentId ?? null,
      employeeId: latestOutbound?.employeeId ?? null,
      phoneNumber,
      toNumber: params.To || null,
      message,
      provider: "twilio",
      providerMessageId,
      requestMeta: params,
    },
    update: {
      departmentId: latestOutbound?.departmentId ?? null,
      employeeId: latestOutbound?.employeeId ?? null,
      phoneNumber,
      toNumber: params.To || null,
      message,
      requestMeta: params,
    },
  });

  return new NextResponse(null, { status: 204 });
}
