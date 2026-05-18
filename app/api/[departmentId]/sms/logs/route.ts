import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSmsAdmin, smsAuthErrorResponse } from "@/lib/auth/require-sms-admin";
import prismadb from "@/lib/prismadb";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export async function GET(
  req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    await requireSmsAdmin(params.departmentId);

    const url = new URL(req.url);
    const query = querySchema.parse({
      page: url.searchParams.get("page") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    const [total, logs] = await Promise.all([
      prismadb.smsLog.count({ where: { departmentId: params.departmentId } }),
      prismadb.smsLog.findMany({
        where: { departmentId: params.departmentId },
        include: {
          employee: {
            select: {
              firstName: true,
              middleName: true,
              lastName: true,
              suffix: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return NextResponse.json({
      total,
      page: query.page,
      limit: query.limit,
      logs: logs.map((log) => ({
        id: log.id,
        employeeName: log.employee
          ? `${log.employee.lastName}, ${[log.employee.firstName, log.employee.middleName, log.employee.suffix]
              .map((part) => part?.trim())
              .filter(Boolean)
              .join(" ")}`
          : null,
        phoneNumber: log.phoneNumber,
        message: log.message,
        senderId: log.senderId,
        provider: log.provider,
        status: log.status,
        errorMessage: log.errorMessage,
        providerMessageId: log.providerMessageId,
        createdAt: log.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    const authResponse = smsAuthErrorResponse(error);
    if (authResponse) return authResponse;

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid log query." }, { status: 400 });
    }

    console.error("[sms-logs] failed", error);
    return NextResponse.json({ error: "Unable to load SMS logs." }, { status: 500 });
  }
}
