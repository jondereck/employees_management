import * as XLSX from "xlsx-js-style";

import type { PivotField, PivotResult } from "@/lib/workforce-pivot";

export type PivotFieldLabels = Record<PivotField, string>;

const BORDER = {
  top: { style: "thin", color: { rgb: "E2E8F0" } },
  bottom: { style: "thin", color: { rgb: "E2E8F0" } },
  left: { style: "thin", color: { rgb: "E2E8F0" } },
  right: { style: "thin", color: { rgb: "E2E8F0" } },
} as const;

function pivotTitle(result: PivotResult, fieldLabels: PivotFieldLabels): string {
  const rowLabel = result.rowFields.map((field) => fieldLabels[field]).join(" + ");
  return `${rowLabel} × ${fieldLabels[result.colField]}`;
}

function sanitizeFilenamePart(value: string): string {
  return value.replace(/\s+/g, "_").replace(/[^\w+.-]/g, "");
}

export function workforcePivotExportFilename({
  result,
  fieldLabels,
  generatedAt = new Date(),
}: {
  result: PivotResult;
  fieldLabels: PivotFieldLabels;
  generatedAt?: Date;
}): string {
  const rowPart = result.rowFields
    .map((field) => sanitizeFilenamePart(fieldLabels[field]))
    .join("+");
  const colPart = sanitizeFilenamePart(fieldLabels[result.colField]);
  const datePart = generatedAt.toISOString().slice(0, 10);
  return `Workforce_Pivot_${rowPart}_x_${colPart}_${datePart}.xlsx`;
}

export function buildWorkforcePivotExportRows({
  result,
  fieldLabels,
  generatedAt = new Date(),
}: {
  result: PivotResult;
  fieldLabels: PivotFieldLabels;
  generatedAt?: Date;
}): { title: string; rows: (string | number)[][] } {
  const title = pivotTitle(result, fieldLabels);
  const nested = result.rowFields.length === 2;
  const header = nested
    ? [
        fieldLabels[result.rowFields[0]],
        fieldLabels[result.rowFields[1]],
        ...result.cols.map((col) => col.name),
        "Total",
      ]
    : [fieldLabels[result.rowFields[0]], ...result.cols.map((col) => col.name), "Total"];

  const body = result.rows.map((row, rowIndex) => {
    const values = [...result.matrix[rowIndex], result.rowTotals[rowIndex]];
    if (!nested) {
      return [row.name, ...values];
    }
    const showGroup =
      rowIndex === 0 || result.rows[rowIndex - 1].groupKey !== row.groupKey;
    return [
      showGroup ? (row.groupLabel ?? "") : "",
      row.leafLabel ?? row.name,
      ...values,
    ];
  });

  const totalRow = nested
    ? ["Total", "", ...result.colTotals, result.grandTotal]
    : ["Total", ...result.colTotals, result.grandTotal];

  const rows: (string | number)[][] = [
    [title],
    [
      `Generated: ${generatedAt.toLocaleString()} · ${result.grandTotal} employees matched`,
    ],
    header,
    ...body,
    totalRow,
  ];

  return { title, rows };
}

export function exportWorkforcePivotExcel({
  result,
  fieldLabels,
  generatedAt = new Date(),
}: {
  result: PivotResult;
  fieldLabels: PivotFieldLabels;
  generatedAt?: Date;
}) {
  const { title, rows } = buildWorkforcePivotExportRows({
    result,
    fieldLabels,
    generatedAt,
  });
  const nested = result.rowFields.length === 2;
  const labelCols = nested ? 2 : 1;
  const totalCols = labelCols + result.cols.length + 1;
  const headerRowIndex = 2;
  const totalRowIndex = rows.length - 1;

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const lastCol = XLSX.utils.encode_col(totalCols - 1);
  worksheet["!merges"] = [
    XLSX.utils.decode_range(`A1:${lastCol}1`),
    XLSX.utils.decode_range(`A2:${lastCol}2`),
  ];
  worksheet["!cols"] = Array.from({ length: totalCols }, (_, index) => ({
    wch: index < labelCols ? 28 : 12,
  }));
  worksheet["!rows"] = [{ hpt: 28 }, { hpt: 20 }, { hpt: 24 }];

  const titleCell = worksheet.A1 as XLSX.CellObject & { s?: object };
  if (titleCell) {
    titleCell.s = {
      font: { bold: true, sz: 16, color: { rgb: "0F172A" } },
      alignment: { vertical: "center" },
    };
  }
  const metaCell = worksheet.A2 as XLSX.CellObject & { s?: object };
  if (metaCell) {
    metaCell.s = {
      font: { italic: true, color: { rgb: "64748B" } },
    };
  }

  for (let column = 0; column < totalCols; column += 1) {
    const cell = worksheet[
      XLSX.utils.encode_cell({ r: headerRowIndex, c: column })
    ] as (XLSX.CellObject & { s?: object }) | undefined;
    if (!cell) continue;
    cell.s = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { patternType: "solid", fgColor: { rgb: "0F172A" } },
      alignment: {
        horizontal: column < labelCols ? "left" : "right",
        vertical: "center",
        wrapText: true,
      },
      border: BORDER,
    };
  }

  for (let rowIndex = headerRowIndex + 1; rowIndex < totalRowIndex; rowIndex += 1) {
    const dataIndex = rowIndex - (headerRowIndex + 1);
    for (let column = 0; column < totalCols; column += 1) {
      const cell = worksheet[
        XLSX.utils.encode_cell({ r: rowIndex, c: column })
      ] as (XLSX.CellObject & { s?: object }) | undefined;
      if (!cell) continue;
      cell.s = {
        ...(dataIndex % 2 === 1
          ? { fill: { patternType: "solid", fgColor: { rgb: "F8FAFC" } } }
          : {}),
        alignment: {
          horizontal: column < labelCols ? "left" : "right",
          vertical: "center",
        },
        border: BORDER,
      };
    }
  }

  for (let column = 0; column < totalCols; column += 1) {
    const cell = worksheet[
      XLSX.utils.encode_cell({ r: totalRowIndex, c: column })
    ] as (XLSX.CellObject & { s?: object }) | undefined;
    if (!cell) continue;
    cell.s = {
      font: { bold: true, color: { rgb: "0F172A" } },
      fill: { patternType: "solid", fgColor: { rgb: "E2E8F0" } },
      alignment: {
        horizontal: column < labelCols ? "left" : "right",
        vertical: "center",
      },
      border: BORDER,
    };
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Workforce Pivot");
  XLSX.writeFile(
    workbook,
    workforcePivotExportFilename({ result, fieldLabels, generatedAt }),
    { compression: true }
  );

  return title;
}
