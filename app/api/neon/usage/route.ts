// app/api/neon/usage/route.ts
import { NextRequest, NextResponse } from "next/server";

const BASE = "https://console.neon.tech/api/v2";

async function getOrgId(bearer: string) {
  // If you already set NEON_ORG_ID, use that
  if (process.env.NEON_ORG_ID) return process.env.NEON_ORG_ID;

  const res = await fetch(`${BASE}/users/me/organizations`, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${bearer}`,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to list organizations: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  // naive pick: first org; you can filter by name/plan if you belong to multiple
  return data.organizations?.[0]?.id as string;
}

function toIsoUtc(d: Date) {
  // format YYYY-MM-DDT00:00:00Z
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString();
}

export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.NEON_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Missing NEON_API_KEY" }, { status: 500 });

    const { searchParams } = new URL(req.url);
    const granularity = searchParams.get("granularity") ?? "daily"; // hourly | daily | monthly
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    // Default: last 14 days in Asia/Manila converted to UTC dates
    const tzNow = new Date(); // your server time; fine for daily windows
    const end = toParam ? new Date(toParam) : tzNow;
    const start = fromParam ? new Date(fromParam) : new Date(end.getTime() - 13 * 24 * 3600 * 1000);

    const fromISO = toIsoUtc(start);
    const toISO = toIsoUtc(end);

    const orgId = await getOrgId(apiKey);

    const url = new URL(`${BASE}/consumption_history/projects`);
    url.searchParams.set("org_id", orgId);
    url.searchParams.set("from", fromISO);
    url.searchParams.set("to", toISO);
    url.searchParams.set("granularity", granularity);
    url.searchParams.set("limit", "50"); // pagination knob if you have many projects

    const res = await fetch(url.toString(), {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const t = await res.text();
      return NextResponse.json({ error: `Neon API error: ${res.status} ${t}` }, { status: 500 });
    }

    const data = await res.json();
    // data shape:
    // {
    //   projects: [
    //     {
    //       project_id: "...",
    //       periods: [
    //         {
    //           period_plan: "scale",
    //           consumption: [
    //             { timeframe_start, timeframe_end, compute_time_seconds, active_time_seconds, ... }
    //           ]
    //         }
    //       ]
    //     }
    //   ]
    // }

    // Flatten to daily rows and compute CU-hours
    type Row = {
      date: string;           // YYYY-MM-DD
      projectId: string;
      cuHours: number;
      activeHours: number;
    };

    const rows: Row[] = [];

    for (const p of data.projects ?? []) {
      const projectId = p.project_id;
      for (const period of p.periods ?? []) {
        for (const c of period.consumption ?? []) {
          const day = (c.timeframe_start ?? "").slice(0, 10); // YYYY-MM-DD
          const cuHours = (c.compute_time_seconds ?? 0) / 3600;
          const activeHours = (c.active_time_seconds ?? 0) / 3600;

          rows.push({ date: day, projectId, cuHours, activeHours });
        }
      }
    }

    // Aggregate per day per project (some granularities might emit multiple windows)
    const key = (r: Row) => `${r.projectId}|${r.date}`;
    const byKey = new Map<string, Row>();
    for (const r of rows) {
      const k = key(r);
      const prev = byKey.get(k);
      if (prev) {
        prev.cuHours += r.cuHours;
        prev.activeHours += r.activeHours;
      } else {
        byKey.set(k, { ...r });
      }
    }

    // Also compute daily totals across all projects
    const dailyTotal = new Map<string, number>();
    for (const r of byKey.values()) {
      dailyTotal.set(r.date, (dailyTotal.get(r.date) ?? 0) + r.cuHours);
    }

    return NextResponse.json({
      orgId,
      granularity,
      from: fromISO,
      to: toISO,
      rows: Array.from(byKey.values()),
      totals: Array.from(dailyTotal, ([date, cuHours]) => ({ date, cuHours })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
