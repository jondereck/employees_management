"use server";

import { db } from "@/lib/db";

export async function bulkUpdateEmployees(ids: string[], action: string) {
  if (!ids || ids.length === 0) return;

  if (action === "delete") {
    await db.employee.deleteMany({
      where: {
        id: { in: ids },
      },
    });
  } else {
    const status = action === "activate" ? "ACTIVE" : "INACTIVE";
    await db.employee.updateMany({
      where: {
        id: { in: ids },
      },
      data: {
        status,
      },
    });
  }
}
