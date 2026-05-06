import { NextRequest, NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sgParam = searchParams.get("sg");
    const sg = Number(sgParam);

    const maxGradeRecord = await prismadb.salary.findFirst({
      select: { grade: true },
      orderBy: { grade: "desc" },
    });
    const maxGrade = maxGradeRecord?.grade ?? 33;

    if (!sgParam) {
      return NextResponse.json({ maxGrade });
    }

    if (!sg || sg <= 0) {
      return NextResponse.json(
        { error: "Invalid sg query param", maxGrade },
        { status: 400 }
      );
    }

    if (sg > maxGrade) {
      return NextResponse.json(
        { error: `Salary Grade cannot exceed SG ${maxGrade}`, maxGrade },
        { status: 400 }
      );
    }

    // Fetch all steps for the given grade
    const salaryRecords = await prismadb.salary.findMany({
      where: { grade: sg },
      orderBy: { step: "asc" },
    });

    if (!salaryRecords || salaryRecords.length === 0) {
      return NextResponse.json(
        { error: "Salary data not found", maxGrade },
        { status: 404 }
      );
    }

    // Build a map: step -> amount
    const steps: Record<number, number> = {};
    salaryRecords.forEach((s) => {
      steps[s.step] = s.amount;
    });

    return NextResponse.json({ sg, steps, maxGrade });
  } catch (err) {
    console.error("API Error:", err);
    return NextResponse.json(
      { error: "Failed to load salary data" },
      { status: 500 }
    );
  }
}
