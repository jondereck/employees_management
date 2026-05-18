import { NextResponse } from "next/server";

import { requireSmsAdmin, smsAuthErrorResponse } from "@/lib/auth/require-sms-admin";
import prismadb from "@/lib/prismadb";

type InboxMessage = {
  id: string;
  direction: "inbound" | "outbound";
  phoneNumber: string;
  employeeName: string | null;
  message: string;
  status: string;
  provider: string;
  createdAt: string;
};

export async function GET(
  _req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    await requireSmsAdmin(params.departmentId);

    const [inbound, outbound] = await Promise.all([
      prismadb.smsInboundMessage.findMany({
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
        take: 100,
      }),
      prismadb.smsLog.findMany({
        where: { departmentId: params.departmentId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    const messages: InboxMessage[] = [
      ...inbound.map((message) => ({
        id: message.id,
        direction: "inbound" as const,
        phoneNumber: message.phoneNumber,
        employeeName: message.employee
          ? `${message.employee.lastName}, ${[message.employee.firstName, message.employee.middleName, message.employee.suffix]
              .map((part) => part?.trim())
              .filter(Boolean)
              .join(" ")}`
          : null,
        message: message.message,
        status: "RECEIVED",
        provider: message.provider,
        createdAt: message.createdAt.toISOString(),
      })),
      ...outbound.map((message) => ({
        id: message.id,
        direction: "outbound" as const,
        phoneNumber: message.phoneNumber,
        employeeName: null,
        message: message.message,
        status: message.status,
        provider: message.provider,
        createdAt: message.createdAt.toISOString(),
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const threads = Array.from(
      messages.reduce((map, message) => {
        const existing = map.get(message.phoneNumber);
        if (!existing) {
          map.set(message.phoneNumber, {
            phoneNumber: message.phoneNumber,
            employeeName: message.employeeName,
            latestMessage: message.message,
            latestAt: message.createdAt,
            latestDirection: message.direction,
            messages: [message],
          });
          return map;
        }

        if (!existing.employeeName && message.employeeName) {
          existing.employeeName = message.employeeName;
        }
        existing.messages.push(message);
        return map;
      }, new Map<string, {
        phoneNumber: string;
        employeeName: string | null;
        latestMessage: string;
        latestAt: string;
        latestDirection: "inbound" | "outbound";
        messages: InboxMessage[];
      }>())
    ).map(([, thread]) => ({
      ...thread,
      messages: thread.messages.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
    }));

    return NextResponse.json({ threads });
  } catch (error) {
    const authResponse = smsAuthErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("[sms-inbox] failed", error);
    return NextResponse.json({ error: "Unable to load SMS inbox." }, { status: 500 });
  }
}
