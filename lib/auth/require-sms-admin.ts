import { currentUser } from "@clerk/nextjs/server";
import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";

const SMS_ADMIN_ROLES = new Set(["admin", "owner"]);

export class SmsAuthError extends Error {
  status: 401 | 403 | 404;

  constructor(status: 401 | 403 | 404, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireSmsAdmin(departmentId: string) {
  const { userId } = auth();
  if (!userId) {
    throw new SmsAuthError(401, "Authentication is required.");
  }

  const department = await prismadb.department.findUnique({
    where: { id: departmentId },
    select: { id: true, userId: true },
  });

  if (!department) {
    throw new SmsAuthError(404, "Department not found.");
  }

  const user = await currentUser().catch(() => null);
  const metadata = (user?.publicMetadata ?? {}) as Record<string, unknown>;
  const role = typeof metadata.role === "string" ? metadata.role.toLowerCase() : "";
  const isRoleAllowed = SMS_ADMIN_ROLES.has(role);
  const isDepartmentOwner = department.userId === userId;

  if (!isRoleAllowed && !isDepartmentOwner) {
    throw new SmsAuthError(403, "You do not have access to the SMS tool.");
  }

  return {
    userId,
    departmentId: department.id,
    isDepartmentOwner,
    role,
  };
}

export function smsAuthErrorResponse(error: unknown) {
  if (error instanceof SmsAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return null;
}
