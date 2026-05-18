import { Prisma, SmsLogStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSmsAdmin, smsAuthErrorResponse } from "@/lib/auth/require-sms-admin";
import { normalizePhilippineMobileNumber } from "@/lib/phone";
import prismadb from "@/lib/prismadb";
import { getTwilioWebhookBaseUrl, sendTwilioSms } from "@/lib/sms/twilio";

const MAX_REPLY_LENGTH = 1600;

const replySchema = z.object({
  phoneNumber: z.string().min(1),
  message: z.string().transform((value) => value.trim()).pipe(z.string().min(1).max(MAX_REPLY_LENGTH)),
});

function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value == null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function buildStatusCallbackUrl(request: Request) {
  const configuredBaseUrl = getTwilioWebhookBaseUrl();
  if (configuredBaseUrl) {
    return `${configuredBaseUrl}/api/webhooks/twilio/sms/status`;
  }

  const url = new URL(request.url);
  return `${url.origin}/api/webhooks/twilio/sms/status`;
}

export async function POST(
  req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    const access = await requireSmsAdmin(params.departmentId);
    const body = replySchema.parse(await req.json());
    const normalized = normalizePhilippineMobileNumber(body.phoneNumber);

    if (!normalized.ok) {
      return NextResponse.json({ error: normalized.error }, { status: 400 });
    }

    const latestThreadMessage = await prismadb.smsInboundMessage.findFirst({
      where: {
        departmentId: params.departmentId,
        phoneNumber: normalized.value,
      },
      orderBy: { createdAt: "desc" },
      select: { employeeId: true },
    });

    const providerResult = await sendTwilioSms({
      recipient: normalized.value,
      content: body.message,
      statusCallbackUrl: buildStatusCallbackUrl(req),
      metadata: {
        departmentId: params.departmentId,
        source: "inbox-reply",
        createdByUserId: access.userId,
      },
    });

    await prismadb.smsLog.create({
      data: {
        departmentId: params.departmentId,
        employeeId: latestThreadMessage?.employeeId ?? null,
        phoneNumber: normalized.value,
        message: body.message,
        provider: "twilio",
        providerMessageId: providerResult.providerMessageId,
        status: providerResult.ok ? SmsLogStatus.QUEUED : SmsLogStatus.FAILED,
        errorMessage: providerResult.errorMessage,
        requestMeta: toJsonValue({ source: "inbox-reply" }),
        responseBody: toJsonValue(providerResult.responseBody),
        createdByUserId: access.userId,
      },
    });

    return NextResponse.json({
      ok: providerResult.ok,
      status: providerResult.ok ? "QUEUED" : "FAILED",
      providerMessageId: providerResult.providerMessageId,
      errorMessage: providerResult.errorMessage,
    });
  } catch (error) {
    const authResponse = smsAuthErrorResponse(error);
    if (authResponse) return authResponse;

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid reply request." },
        { status: 400 }
      );
    }

    console.error("[sms-reply] failed", error);
    return NextResponse.json({ error: "Unable to send reply." }, { status: 500 });
  }
}
