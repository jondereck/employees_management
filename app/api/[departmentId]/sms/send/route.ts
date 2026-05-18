import { NextResponse } from "next/server";
import { Prisma, SmsLogStatus } from "@prisma/client";
import { z } from "zod";

import { requireSmsAdmin, smsAuthErrorResponse } from "@/lib/auth/require-sms-admin";
import { normalizePhilippineMobileNumber } from "@/lib/phone";
import prismadb from "@/lib/prismadb";
import { sendSmsViaProviders } from "@/lib/sms/providers";
import { getTwilioWebhookBaseUrl } from "@/lib/sms/twilio";

const MAX_SMS_LENGTH = 1600;

const sendSmsSchema = z
  .object({
    message: z.string().transform((value) => value.trim()).pipe(z.string().min(1).max(MAX_SMS_LENGTH)),
    employeeIds: z.array(z.string().min(1)).optional(),
    phoneNumber: z
      .string()
      .optional()
      .transform((value) => value?.trim() || undefined),
    senderId: z
      .string()
      .optional()
      .transform((value) => value?.trim() || undefined)
      .pipe(z.string().max(50).optional()),
  })
  .superRefine((value, ctx) => {
    if (!value.phoneNumber && (!value.employeeIds || value.employeeIds.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose at least one employee or enter one phone number.",
        path: ["employeeIds"],
      });
    }
  });

type SmsTarget = {
  employeeId: string | null;
  employeeName: string | null;
  phoneNumber: string;
  source: "employee" | "direct";
};

type SmsSendResult = {
  employeeId: string | null;
  employeeName: string | null;
  phoneNumber: string | null;
  normalizedPhoneNumber: string | null;
  status: "QUEUED" | "SENT" | "FAILED";
  provider: string | null;
  errorMessage: string | null;
  providerMessageId: string | null;
};

function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value == null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function employeeName(employee: {
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
}) {
  return `${employee.lastName}, ${[employee.firstName, employee.middleName, employee.suffix]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ")}`;
}

async function writeSmsLog(input: {
  departmentId: string;
  employeeId: string | null;
  phoneNumber: string;
  message: string;
  senderId?: string;
  status: SmsLogStatus;
  errorMessage?: string | null;
  providerMessageId?: string | null;
  provider?: string | null;
  requestMeta?: Record<string, unknown>;
  responseBody?: unknown;
  createdByUserId: string;
}) {
  await prismadb.smsLog.create({
    data: {
      departmentId: input.departmentId,
      employeeId: input.employeeId,
      phoneNumber: input.phoneNumber,
      message: input.message,
      provider: input.provider || undefined,
      senderId: input.senderId || null,
      status: input.status,
      errorMessage: input.errorMessage || null,
      providerMessageId: input.providerMessageId || null,
      requestMeta: toJsonValue(input.requestMeta),
      responseBody: toJsonValue(input.responseBody),
      createdByUserId: input.createdByUserId,
    },
  });
}

function buildStatusCallbackUrl(request: Request) {
  const configuredBaseUrl = getTwilioWebhookBaseUrl();
  if (configuredBaseUrl) {
    return `${configuredBaseUrl}/api/webhooks/twilio/sms/status`;
  }

  const url = new URL(request.url);
  return `${url.origin}/api/webhooks/twilio/sms/status`;
}

function statusForProviderResult(result: { provider: string; ok: boolean; queued: boolean }) {
  if (!result.ok) return SmsLogStatus.FAILED;
  if (result.provider === "twilio" && result.queued) return SmsLogStatus.QUEUED;
  return SmsLogStatus.SENT;
}

export async function POST(
  req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    const access = await requireSmsAdmin(params.departmentId);
    const body = sendSmsSchema.parse(await req.json());
    const employeeIds = Array.from(new Set(body.employeeIds ?? []));

    const targets: SmsTarget[] = [];
    if (body.phoneNumber) {
      targets.push({
        employeeId: null,
        employeeName: null,
        phoneNumber: body.phoneNumber,
        source: "direct",
      });
    }

    if (employeeIds.length > 0) {
      const employees = await prismadb.employee.findMany({
        where: {
          departmentId: params.departmentId,
          id: { in: employeeIds },
          isArchived: false,
        },
        select: {
          id: true,
          firstName: true,
          middleName: true,
          lastName: true,
          suffix: true,
          contactNumber: true,
        },
      });
      const employeesById = new Map(employees.map((employee) => [employee.id, employee]));

      for (const employeeId of employeeIds) {
        const employee = employeesById.get(employeeId);
        if (!employee) {
          targets.push({
            employeeId: null,
            employeeName: null,
            phoneNumber: "",
            source: "employee",
          });
          continue;
        }

        targets.push({
          employeeId: employee.id,
          employeeName: employeeName(employee),
          phoneNumber: employee.contactNumber,
          source: "employee",
        });
      }
    }

    const seenNumbers = new Set<string>();
    const results: SmsSendResult[] = [];

    for (const target of targets) {
      const normalized = normalizePhilippineMobileNumber(target.phoneNumber);

      if (!normalized.ok) {
        await writeSmsLog({
          departmentId: params.departmentId,
          employeeId: target.employeeId,
          phoneNumber: target.phoneNumber.trim(),
          message: body.message,
          senderId: body.senderId,
          status: SmsLogStatus.FAILED,
          errorMessage: target.phoneNumber ? normalized.error : "Employee has no contact number.",
          provider: null,
          requestMeta: { source: target.source, rawPhoneNumber: target.phoneNumber },
          createdByUserId: access.userId,
        });

        results.push({
          employeeId: target.employeeId,
          employeeName: target.employeeName,
          phoneNumber: target.phoneNumber || null,
          normalizedPhoneNumber: null,
          status: "FAILED",
          provider: null,
          errorMessage: target.phoneNumber ? normalized.error : "Employee has no contact number.",
          providerMessageId: null,
        });
        continue;
      }

      if (seenNumbers.has(normalized.value)) {
        continue;
      }
      seenNumbers.add(normalized.value);

      const providerResult = await sendSmsViaProviders({
        recipient: normalized.value,
        content: body.message,
        senderId: body.senderId,
        statusCallbackUrl: buildStatusCallbackUrl(req),
        metadata: {
          departmentId: params.departmentId,
          employeeId: target.employeeId,
          source: target.source,
          createdByUserId: access.userId,
        },
      });

      await writeSmsLog({
        departmentId: params.departmentId,
        employeeId: target.employeeId,
        phoneNumber: normalized.value,
        message: body.message,
        senderId: body.senderId,
        status: statusForProviderResult(providerResult),
        provider: providerResult.provider,
        errorMessage: providerResult.errorMessage,
        providerMessageId: providerResult.providerMessageId,
        requestMeta: {
          source: target.source,
          rawPhoneNumber: target.phoneNumber,
          attempts: providerResult.attempts,
        },
        responseBody: providerResult.responseBody,
        createdByUserId: access.userId,
      });

      results.push({
        employeeId: target.employeeId,
        employeeName: target.employeeName,
        phoneNumber: target.phoneNumber,
        normalizedPhoneNumber: normalized.value,
        status: providerResult.ok ? (providerResult.provider === "twilio" ? "QUEUED" : "SENT") : "FAILED",
        provider: providerResult.provider,
        errorMessage: providerResult.errorMessage,
        providerMessageId: providerResult.providerMessageId,
      });
    }

    const sent = results.filter((result) => result.status === "SENT" || result.status === "QUEUED").length;
    const failed = results.filter((result) => result.status === "FAILED").length;

    return NextResponse.json({
      total: results.length,
      sent,
      failed,
      results,
    });
  } catch (error) {
    const authResponse = smsAuthErrorResponse(error);
    if (authResponse) return authResponse;

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid SMS request." },
        { status: 400 }
      );
    }

    console.error("[sms-send] failed", error);
    return NextResponse.json({ error: "Unable to send SMS." }, { status: 500 });
  }
}
