import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import Papa from "papaparse";

type SalaryRow = {
  SG: number;
  Step: number;
  Salary: number;
};

let salaryTable: Record<number, Record<number, number>> | null = null;

// Load and cache the salary table
function loadSalaryTable() {
  if (salaryTable) return salaryTable;

  const filePath = path.join(process.cwd(), "data", "salary_grades.csv");
  const csvData = fs.readFileSync(filePath, "utf-8");

  const parsed = Papa.parse<SalaryRow>(csvData, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });

  salaryTable = {};
  parsed.data.forEach((row) => {
    if (!row.SG || !row.Step || !row.Salary) return;
    if (!salaryTable![row.SG]) salaryTable![row.SG] = {};
    salaryTable![row.SG][row.Step] = row.Salary;
  });

  return salaryTable;
}

// ✅ Correct API handler with named export only
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sg = searchParams.get("sg");
    const step = searchParams.get("step");

    if (!sg || !step) {
      return NextResponse.json(
        { error: "Missing sg or step query params" },
        { status: 400 }
      );
    }

    const table = loadSalaryTable();
    const salary = table[Number(sg)]?.[Number(step)] ?? null;

    if (salary === null) {
      return NextResponse.json({ error: "Salary not found" }, { status: 404 });
    }

    return NextResponse.json({
      sg: Number(sg),
      step: Number(step),
      salary,
    });
  } catch (err) {
    console.error("API Error:", err);
    return NextResponse.json(
      { error: "Failed to load salary data" },
      { status: 500 }
    );
  }
}
