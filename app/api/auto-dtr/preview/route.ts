import { NextResponse } from "next/server";

import type { DTRPreview, ManualExclusion } from "@/types/autoDtr";

type RequestPayload = {
  month: number;
  year: number;
  splitTime: string;
  rounding: "none" | "5" | "10";
  manualExclusions: ManualExclusion[];
  employeeIds: string[];
  officeIds: string[];
  files: { name: string; size: number; type: string }[];
};

export async function POST(request: Request) {
  const payload = (await request.json()) as RequestPayload;
  const { month, year, employeeIds } = payload;

  const preview: DTRPreview = {
    month,
    year,
    rows: employeeIds.map((id, index) => ({
      employeeId: id,
      employeeNo: id,
      name: `Employee ${index + 1}`,
      days: {},
    })),
  };

  return NextResponse.json({ preview });
}
