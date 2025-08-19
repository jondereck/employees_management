import * as XLSX from "xlsx";

let salaryTable: Record<number, Record<number, number>> = {};

export async function loadSalaryTableXLSX(file: File) {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<{ SG: number; Step: number; Salary: number }>(sheet);

  salaryTable = {};
  rows.forEach((row) => {
    if (!salaryTable[row.SG]) salaryTable[row.SG] = {};
    salaryTable[row.SG][row.Step] = row.Salary;
  });
}

export function getSalary(sg: number, step: number): number | null {
  return salaryTable[sg]?.[step] ?? null;
}
