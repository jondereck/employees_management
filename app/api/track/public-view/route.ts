export const runtime = "nodejs";

import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";
import { PostHog } from "posthog-node";

const posthog = process.env.POSTHOG_PROJECT_API_KEY
  ? new PostHog(process.env.POSTHOG_PROJECT_API_KEY!, {
      host: process.env.POSTHOG_HOST || "https://us.posthog.com",
    })
  : null;

function tsPH(d = new Date()) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export async function POST(req: Request) {
  try {
    const { viewedEmployeeId, departmentId, viewerId, viewerEmployeeNo, anonId } = await req.json();
    if (!viewedEmployeeId) {
      return NextResponse.json({ error: "viewedEmployeeId required" }, { status: 400 });
    }

    // 1) Always fetch the PROFILE being viewed (for columns even if viewer is anonymous)
    const viewed = await prismadb.employee.findUnique({
      where: { id: viewedEmployeeId },
      select: {
        firstName: true,
        middleName: true,
        lastName: true,
        offices: { select: { name: true } },
      },
    });

    const profileName = viewed
      ? `${viewed.firstName}${viewed.middleName?.trim() ? " " + viewed.middleName[0].toUpperCase() + "." : ""} ${viewed.lastName}`.replace(/\s+/g," ").trim()
      : null;
    const profileOffice = viewed?.offices?.name ?? null;

    // 2) Try to resolve VIEWER if hints exist
    let resolvedViewerId: string | null = null;
    let viewerName: string | null = null;
    let viewerOfficeName: string | null = null;

    if (viewerId || viewerEmployeeNo) {
      const v = await prismadb.employee.findFirst({
        where: {
          OR: [
            viewerId ? { id: viewerId } : undefined,
            viewerEmployeeNo ? { employeeNo: viewerEmployeeNo } : undefined,
          ].filter(Boolean) as any[],
        },
        select: {
          id: true,
          firstName: true,
          middleName: true,
          lastName: true,
          offices: { select: { name: true } },
        },
      });

      if (v) {
        resolvedViewerId = v.id;
        viewerName = `${v.firstName}${v.middleName?.trim() ? " " + v.middleName[0].toUpperCase() + "." : ""} ${v.lastName}`.replace(/\s+/g," ").trim();
        viewerOfficeName = v.offices?.name ?? null;
      }
    }

    const distinctId = resolvedViewerId || viewerId || anonId || "guest";

    const props = {
      event: "public_profile_pageview",
      // who is being viewed (always present)
      viewedEmployeeId,
      profileName,
      profileOffice,

      // who viewed (if known)
      viewerId: resolvedViewerId || viewerId || null,
      viewerEmployeeNo: viewerEmployeeNo || null,
      viewerName,
      viewerOfficeName,

      // context
      departmentId: departmentId || null,
      anonId: anonId || null,
      ts_iso: new Date().toISOString(),
      ts_ph: tsPH(),
    };

    if (posthog) {
      posthog.capture({
        distinctId,
        event: "public_profile_pageview",
        properties: props,
      });

      // If we know the viewer, set person properties so the “Person” shows the name
      if (viewerName) {
        posthog.identify({
          distinctId,
          properties: {
            name: viewerName,
            office: viewerOfficeName,
            employeeNo: viewerEmployeeNo,
            type: "Employee",
          },
        });
      }

      posthog.flush();
    } else {
      console.log("[TRACK PV]", props);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, info: "POST here to log public profile pageviews." });
}
