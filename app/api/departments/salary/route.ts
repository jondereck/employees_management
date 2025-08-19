import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sg = Number(searchParams.get("sg"));

    if (!sg || sg <= 0) {
      return NextResponse.json(
        { error: "Missing or invalid sg query param" },
        { status: 400 }
      );
    }

    // Fetch all steps for the given grade
    const salaryRecords = await prisma.salary.findMany({
      where: { grade: sg },
      orderBy: { step: "asc" },
    });

    if (!salaryRecords || salaryRecords.length === 0) {
      return NextResponse.json(
        { error: "Salary data not found" },
        { status: 404 }
      );
    }

    // Build a map: step -> amount
    const steps: Record<number, number> = {};
    salaryRecords.forEach((s) => {
      steps[s.step] = s.amount;
    });

    return NextResponse.json({ sg, steps });
  } catch (err) {
    console.error("API Error:", err);
    return NextResponse.json(
      { error: "Failed to load salary data" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
