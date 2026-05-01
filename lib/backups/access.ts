import { auth, currentUser } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";

const ADMIN_ROLES = new Set(["admin", "owner"]);

export class BackupHttpError extends Error {
  status: number;
  details?: string[];

  constructor(status: number, message: string, details?: string[]) {
    super(message);
    this.name = "BackupHttpError";
    this.status = status;
    this.details = details;
  }
}

export type BackupAccess = {
  userId: string;
  department: {
    id: string;
    name: string;
    userId: string;
  };
};

export async function requireBackupAccess(departmentId: string): Promise<BackupAccess> {
  const { userId } = auth();

  if (!userId) {
    throw new BackupHttpError(401, "Unauthorized");
  }

  const department = await prismadb.department.findUnique({
    where: { id: departmentId },
    select: { id: true, name: true, userId: true },
  });

  if (!department) {
    throw new BackupHttpError(404, "Department not found.");
  }

  if (department.userId === userId) {
    return { userId, department };
  }

  const user = await currentUser().catch(() => null);
  const metadata = (user?.publicMetadata ?? {}) as Record<string, unknown>;
  const role = typeof metadata.role === "string" ? metadata.role.toLowerCase() : "";

  if (ADMIN_ROLES.has(role)) {
    return { userId, department };
  }

  throw new BackupHttpError(403, "Forbidden");
}
