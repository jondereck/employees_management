import type { EmploymentEventType, PrismaClient } from "@prisma/client";

type PrismaLike = PrismaClient | Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export function parseTimelineDate(value?: Date | string | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const slashParts = trimmed.split("/");
  if (slashParts.length === 3) {
    const [month, day, year] = slashParts.map(Number);
    if (month && day && year) {
      const parsed = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0));
}

export function buildEmploymentTitle(
  action: "Hired" | "Promoted",
  input: {
    position?: string | null;
    employeeTypeName?: string | null;
    officeName?: string | null;
  }
) {
  const position = input.position?.trim() || "employee";
  const appointment = input.employeeTypeName?.trim();
  const office = input.officeName?.trim();
  return `${action} as ${position}${appointment ? ` (${appointment})` : ""}${office ? ` in ${office}` : ""}.`;
}

export async function createEmploymentTimelineEventOnce(
  db: PrismaLike,
  input: {
    employeeId: string;
    type: EmploymentEventType;
    occurredAt: Date;
    title: string;
    description?: string | null;
  }
) {
  const details = JSON.stringify({
    title: input.title,
    description: input.description ?? null,
    attachment: null,
  });

  const existing = await db.employmentEvent.findFirst({
    where: {
      employeeId: input.employeeId,
      type: input.type,
      occurredAt: input.occurredAt,
      details,
    },
    select: { id: true },
  });

  if (existing) return existing;

  return db.employmentEvent.create({
    data: {
      employeeId: input.employeeId,
      type: input.type,
      occurredAt: input.occurredAt,
      details,
    },
    select: { id: true },
  });
}
