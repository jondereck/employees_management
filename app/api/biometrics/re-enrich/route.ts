import { NextResponse } from "next/server";
import { z } from "zod";

import {
  AttendanceRowSchema,
  evaluateAttendance,
  type AttendanceRow,
} from "@/app/api/attendance/evaluate/route";

const Payload = z.object({
  entries: z.array(AttendanceRowSchema),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { entries } = Payload.parse(json);

    const result = await evaluateAttendance(entries as AttendanceRow[]);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to re-enrich biometrics evaluation", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const message =
      error instanceof Error ? error.message : "Unable to refresh biometrics evaluation.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
