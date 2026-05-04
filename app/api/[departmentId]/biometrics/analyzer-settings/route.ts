import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@clerk/nextjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const settingScopeSchema = z.enum(["department", "user"]);

const settingItemSchema = z.object({
  scope: settingScopeSchema,
  key: z.string().min(1).max(160),
  value: z.unknown(),
});

const patchSchema = z.object({
  items: z.array(settingItemSchema).min(1).max(50),
});

const normalizeUserId = (scope: z.infer<typeof settingScopeSchema>, userId: string | null) =>
  scope === "department" ? "" : userId || "anonymous";

const isJsonValue = (value: unknown): value is Prisma.InputJsonValue =>
  value !== undefined && typeof value !== "function" && typeof value !== "symbol";

export async function GET(
  request: Request,
  { params }: { params: { departmentId: string } }
) {
  const departmentId = params.departmentId?.trim();
  if (!departmentId) {
    return NextResponse.json({ error: "Department ID is required" }, { status: 400 });
  }

  const { userId } = auth();
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope");
  const key = url.searchParams.get("key");
  const userKey = userId || "anonymous";

  const settings = await prisma.timekeepingAnalyzerSetting.findMany({
    where: {
      departmentId,
      ...(scope === "department" || scope === "user" ? { scope } : {}),
      ...(key ? { key } : {}),
      OR: [
        { scope: "department", userId: "" },
        { scope: "user", userId: userKey },
      ],
    },
    orderBy: [{ scope: "asc" }, { key: "asc" }],
  });

  return NextResponse.json({
    items: settings.map((setting) => ({
      scope: setting.scope,
      key: setting.key,
      value: setting.value,
      updatedAt: setting.updatedAt.toISOString(),
    })),
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: { departmentId: string } }
) {
  const departmentId = params.departmentId?.trim();
  if (!departmentId) {
    return NextResponse.json({ error: "Department ID is required" }, { status: 400 });
  }

  try {
    const payload = patchSchema.parse(await request.json());
    const { userId } = auth();

    const invalid = payload.items.find((item) => !isJsonValue(item.value));
    if (invalid) {
      return NextResponse.json({ error: `Invalid JSON value for ${invalid.key}` }, { status: 400 });
    }

    const saved = await prisma.$transaction(
      payload.items.map((item) => {
        const normalizedUserId = normalizeUserId(item.scope, userId);
        return prisma.timekeepingAnalyzerSetting.upsert({
          where: {
            departmentId_userId_scope_key: {
              departmentId,
              userId: normalizedUserId,
              scope: item.scope,
              key: item.key,
            },
          },
          update: {
            value: item.value as Prisma.InputJsonValue,
          },
          create: {
            departmentId,
            userId: normalizedUserId,
            scope: item.scope,
            key: item.key,
            value: item.value as Prisma.InputJsonValue,
          },
        });
      })
    );

    return NextResponse.json({
      items: saved.map((setting) => ({
        scope: setting.scope,
        key: setting.key,
        value: setting.value,
        updatedAt: setting.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Failed to save analyzer settings", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unable to save analyzer settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
