import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  type BirthdayHeadsFilter,
  type BirthdayPostMode,
  buildBirthdayCaptionFallback,
  generateBirthdayCaption,
  isHrmoOffice,
} from "@/lib/birthday-posts";
import {
  getCurrentMonthIndexInTimeZone,
  getCurrentYearInTimeZone,
  getMonthDayInTimeZone,
} from "@/lib/birthday";
import prismadb from "@/lib/prismadb";

function normalizeMonth(value: unknown) {
  const month = Number(value);
  if (!Number.isFinite(month)) return getCurrentMonthIndexInTimeZone();
  return Math.min(11, Math.max(0, Math.trunc(month)));
}

function normalizeHeadsFilter(value: unknown): BirthdayHeadsFilter {
  return value === "heads-only" ? "heads-only" : "all";
}

function dataUrlToBlob(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const [, mimeType, payload] = match;
  const bytes = Buffer.from(payload, "base64");
  return new Blob([bytes], { type: mimeType });
}

async function requireDepartmentOwner(departmentId: string) {
  const { userId } = auth();
  if (!userId) return { error: new NextResponse("Unauthenticated", { status: 401 }) };

  const department = await prismadb.department.findFirst({
    where: { id: departmentId, userId },
    select: { id: true, name: true },
  });
  if (!department) return { error: new NextResponse("Unauthorized", { status: 403 }) };

  return { department };
}

async function publishToFacebookPage({
  caption,
  imageDataUrl,
}: {
  caption: string;
  imageDataUrl?: string | null;
}) {
  const pageId = process.env.META_FACEBOOK_PAGE_ID;
  const accessToken = process.env.META_FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!pageId || !accessToken || !imageDataUrl) {
    return { status: "postingUnavailable" as const, facebookPostUrl: null };
  }

  const imageBlob = dataUrlToBlob(imageDataUrl);
  if (!imageBlob) {
    return { status: "postingUnavailable" as const, facebookPostUrl: null };
  }

  const formData = new FormData();
  formData.append("access_token", accessToken);
  formData.append("message", caption);
  formData.append("published", "true");
  formData.append("source", imageBlob, "birthday-post.png");

  const response = await fetch(`https://graph.facebook.com/${pageId}/photos`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || "Facebook publish failed");
  }

  const payload = (await response.json()) as { post_id?: string; id?: string };
  const postId = payload.post_id || payload.id || null;
  const facebookPostUrl = postId ? `https://www.facebook.com/${postId.replace("_", "/posts/")}` : null;
  return { status: "posted" as const, facebookPostUrl };
}

export async function POST(
  req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    const access = await requireDepartmentOwner(params.departmentId);
    if (access.error) return access.error;

    const body = await req.json().catch(() => ({}));
    const mode = body?.mode === "individual" ? "individual" : "monthly";
    const month = normalizeMonth(body?.month);
    const headsFilter = normalizeHeadsFilter(body?.headsFilter);
    const excludedIds = Array.isArray(body?.excludedIds)
      ? body.excludedIds.filter((value: unknown): value is string => typeof value === "string")
      : [];

    const employees = await prismadb.employee.findMany({
      where: {
        departmentId: params.departmentId,
        isArchived: false,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        nickname: true,
        birthday: true,
        middleName: true,
        suffix: true,
        prefix: true,
        position: true,
        isHead: true,
        offices: {
          select: { name: true },
        },
      },
    });

    const celebrants = employees
      .filter((employee) => {
        const birthMonthDay = getMonthDayInTimeZone(employee.birthday);
        if (birthMonthDay?.month !== month + 1) return false;
        if (headsFilter === "heads-only" && !employee.isHead && !isHrmoOffice(employee.offices?.name)) return false;
        if (excludedIds.includes(employee.id)) return false;
        return true;
      })
      .map((employee) => ({
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        nickname: employee.nickname,
        birthday: employee.birthday,
        middleName: employee.middleName,
        suffix: employee.suffix,
        prefix: employee.prefix,
        position: employee.position,
        officeName: employee.offices?.name ?? null,
        isHead: employee.isHead,
      }));

    const person =
      mode === "individual"
        ? celebrants.find((employee) => employee.id === body?.personId) ??
          employees
            .filter((employee) => employee.id === body?.personId)
            .map((employee) => ({
              id: employee.id,
              firstName: employee.firstName,
              lastName: employee.lastName,
              nickname: employee.nickname,
              birthday: employee.birthday,
              middleName: employee.middleName,
              suffix: employee.suffix,
              prefix: employee.prefix,
              position: employee.position,
              officeName: employee.offices?.name ?? null,
              isHead: employee.isHead,
            }))[0] ??
          null
        : null;

    if (mode === "individual" && !person) {
      return NextResponse.json({ error: "Birthday celebrant not found." }, { status: 404 });
    }

    if (mode === "monthly" && celebrants.length === 0) {
      return NextResponse.json({ error: "No active birthday celebrants found for this month." }, { status: 404 });
    }

    const captionInput = {
      mode: mode as BirthdayPostMode,
      month,
      year: getCurrentYearInTimeZone(),
      person,
      celebrants,
      departmentName: access.department?.name ?? null,
      officeName: person?.officeName ?? null,
      headsFilter,
    };

    const caption = await generateBirthdayCaption(captionInput);
    const prepareOnly = body?.prepareOnly === true;
    const metaConfigured =
      Boolean(process.env.META_FACEBOOK_PAGE_ID) &&
      Boolean(process.env.META_FACEBOOK_PAGE_ACCESS_TOKEN);

    if (prepareOnly || !metaConfigured) {
      return NextResponse.json({
        caption,
        fallbackCaption: buildBirthdayCaptionFallback(captionInput),
        status: "postingUnavailable",
        facebookPostUrl: null,
      });
    }

    try {
      const publishResult = await publishToFacebookPage({
        caption,
        imageDataUrl: typeof body?.imageDataUrl === "string" ? body.imageDataUrl : null,
      });

      return NextResponse.json({
        caption,
        fallbackCaption: buildBirthdayCaptionFallback(captionInput),
        status: publishResult.status,
        facebookPostUrl: publishResult.facebookPostUrl,
      });
    } catch (error) {
      console.error("Birthday Facebook publish failed", error);
      return NextResponse.json({
        caption,
        fallbackCaption: buildBirthdayCaptionFallback(captionInput),
        status: "postingUnavailable",
        facebookPostUrl: null,
        error: "Automatic Facebook posting is currently unavailable.",
      });
    }
  } catch (error) {
    console.error("[birthday_facebook_post]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
