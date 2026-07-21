import * as XLSX from "xlsx-js-style";

import type {
  OfficeWorkforceMetrics,
  OfficeWorkforceRow,
} from "@/lib/office-workforce";
import {
  OFFICE_WORKFORCE_EXPORT_HEADERS,
  AUTHORIZED_POSITION_EXPORT_HEADERS,
  VACANT_POSITION_EXPORT_HEADERS,
  buildAuthorizedPositionExportRows,
  buildOfficeWorkforceExportRows,
  buildOfficeWorkforceTotalRow,
  buildVacantPositionExportRows,
  officeWorkforceExportFilename,
  type VacantPositionExportItem,
} from "@/lib/office-workforce-export";
import {
  summarizeAuthorizedPositions,
  type AuthorizedPositionSummaryRow,
} from "@/lib/office-workforce-position-summary";
import { getCombinedCrossOfficeCount } from "@/lib/office-workforce-view-model";

const BORDER = {
  top: { style: "thin", color: { rgb: "E2E8F0" } },
  bottom: { style: "thin", color: { rgb: "E2E8F0" } },
  left: { style: "thin", color: { rgb: "E2E8F0" } },
  right: { style: "thin", color: { rgb: "E2E8F0" } },
} as const;

export function exportOfficeWorkforceExcel({
  rows,
  overall,
  vacantPositions,
  authorizedPositions,
  generatedAt = new Date(),
}: {
  rows: readonly OfficeWorkforceRow[];
  overall: OfficeWorkforceMetrics;
  vacantPositions: readonly VacantPositionExportItem[];
  authorizedPositions: readonly AuthorizedPositionSummaryRow[];
  generatedAt?: Date;
}) {
  const dataRows = buildOfficeWorkforceExportRows(rows);
  const totalRow = buildOfficeWorkforceTotalRow(rows);
  const sheetRows = [
    ["OFFICE WORKFORCE REPORT"],
    [`Generated: ${generatedAt.toLocaleString()}`],
    [
      "Active Plantilla",
      overall.activePlantillaSlots,
      "Filled",
      overall.filledPlantillaSlots,
      "Vacant",
      overall.vacantPlantillaSlots,
      "Cross-office",
      getCombinedCrossOfficeCount(overall),
    ],
    [...OFFICE_WORKFORCE_EXPORT_HEADERS],
    ...dataRows,
    totalRow,
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
  const totalExcelRow = sheetRows.length;

  worksheet["!merges"] = [
    XLSX.utils.decode_range("A1:H1"),
    XLSX.utils.decode_range("A2:H2"),
  ];
  worksheet["!cols"] = [
    { wch: 40 },
    { wch: 18 },
    { wch: 12 },
    { wch: 12 },
    { wch: 30 },
    { wch: 30 },
    { wch: 16 },
    { wch: 12 },
  ];
  worksheet["!rows"] = [
    { hpt: 28 },
    { hpt: 20 },
    { hpt: 24 },
    { hpt: 36 },
  ];
  worksheet["!autofilter"] = { ref: `A4:G${totalExcelRow - 1}` };
  (worksheet as any)["!freeze"] = {
    ySplit: 4,
    topLeftCell: "A5",
    activePane: "bottomLeft",
    state: "frozen",
  };

  (worksheet.A1 as any).s = {
    font: { bold: true, sz: 16, color: { rgb: "0F172A" } },
    alignment: { vertical: "center" },
  };
  (worksheet.A2 as any).s = {
    font: { italic: true, color: { rgb: "64748B" } },
  };

  for (let column = 0; column < 8; column += 1) {
    const cell = worksheet[
      XLSX.utils.encode_cell({ r: 2, c: column })
    ] as any;
    if (!cell) continue;
    cell.s = {
      font: { bold: column % 2 === 0, color: { rgb: "334155" } },
      fill: { patternType: "solid", fgColor: { rgb: "F1F5F9" } },
      alignment: { horizontal: column % 2 === 0 ? "left" : "center" },
      border: BORDER,
    };
  }

  OFFICE_WORKFORCE_EXPORT_HEADERS.forEach((_, column) => {
    const cell = worksheet[
      XLSX.utils.encode_cell({ r: 3, c: column })
    ] as any;
    cell.s = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { patternType: "solid", fgColor: { rgb: "0F172A" } },
      alignment: {
        horizontal: column === 0 ? "left" : "center",
        vertical: "center",
        wrapText: true,
      },
      border: BORDER,
    };
  });

  dataRows.forEach((_, dataIndex) => {
    for (let column = 0; column < 7; column += 1) {
      const cell = worksheet[
        XLSX.utils.encode_cell({ r: dataIndex + 4, c: column })
      ] as any;
      if (!cell) continue;
      cell.s = {
        ...(dataIndex % 2 === 1
          ? { fill: { patternType: "solid", fgColor: { rgb: "F8FAFC" } } }
          : {}),
        alignment: {
          horizontal: column === 0 ? "left" : "right",
          vertical: "center",
        },
        border: BORDER,
        ...(column === 6 ? { numFmt: "0.00%" } : {}),
      };
    }
  });

  for (let column = 0; column < 7; column += 1) {
    const cell = worksheet[
      XLSX.utils.encode_cell({ r: totalExcelRow - 1, c: column })
    ] as any;
    cell.s = {
      font: { bold: true, color: { rgb: "0F172A" } },
      fill: { patternType: "solid", fgColor: { rgb: "E2E8F0" } },
      alignment: {
        horizontal: column === 0 ? "left" : "right",
        vertical: "center",
      },
      border: BORDER,
      ...(column === 6 ? { numFmt: "0.00%" } : {}),
    };
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Office Workforce");

  const vacancyRows = buildVacantPositionExportRows(vacantPositions);
  const vacancySheet = XLSX.utils.aoa_to_sheet([
    [...VACANT_POSITION_EXPORT_HEADERS],
    ...vacancyRows,
  ]);
  vacancySheet["!cols"] = [
    { wch: 40 },
    { wch: 18 },
    { wch: 34 },
    { wch: 14 },
    { wch: 28 },
    { wch: 22 },
  ];
  vacancySheet["!rows"] = [{ hpt: 34 }];
  vacancySheet["!autofilter"] = {
    ref: `A1:F${Math.max(1, vacancyRows.length + 1)}`,
  };
  (vacancySheet as any)["!freeze"] = {
    ySplit: 1,
    topLeftCell: "A2",
    activePane: "bottomLeft",
    state: "frozen",
  };

  VACANT_POSITION_EXPORT_HEADERS.forEach((_, column) => {
    const cell = vacancySheet[
      XLSX.utils.encode_cell({ r: 0, c: column })
    ] as any;
    cell.s = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { patternType: "solid", fgColor: { rgb: "0F172A" } },
      alignment: {
        horizontal: column === 0 || column === 2 ? "left" : "center",
        vertical: "center",
        wrapText: true,
      },
      border: BORDER,
    };
  });

  vacancyRows.forEach((_, rowIndex) => {
    for (let column = 0; column < 6; column += 1) {
      const cell = vacancySheet[
        XLSX.utils.encode_cell({ r: rowIndex + 1, c: column })
      ] as any;
      if (!cell) continue;
      cell.s = {
        ...(rowIndex % 2 === 1
          ? { fill: { patternType: "solid", fgColor: { rgb: "F8FAFC" } } }
          : {}),
        alignment: {
          horizontal: column === 3 ? "right" : "left",
          vertical: "center",
        },
        border: BORDER,
      };
    }
  });
  XLSX.utils.book_append_sheet(workbook, vacancySheet, "Vacant Positions");

  const authorizedRows =
    buildAuthorizedPositionExportRows(authorizedPositions);
  const authorizedTotals = summarizeAuthorizedPositions(authorizedPositions);
  const authorizedTotalRow = [
    "TOTAL",
    "",
    "",
    authorizedTotals.totalAuthorized,
    authorizedTotals.filled,
    authorizedTotals.vacant,
  ];
  const authorizedSheet = XLSX.utils.aoa_to_sheet([
    [...AUTHORIZED_POSITION_EXPORT_HEADERS],
    ...authorizedRows,
    authorizedTotalRow,
  ]);
  authorizedSheet["!cols"] = [
    { wch: 40 },
    { wch: 38 },
    { wch: 22 },
    { wch: 18 },
    { wch: 12 },
    { wch: 12 },
  ];
  authorizedSheet["!rows"] = [{ hpt: 34 }];
  authorizedSheet["!autofilter"] = {
    ref: `A1:F${Math.max(1, authorizedRows.length + 2)}`,
  };
  (authorizedSheet as any)["!freeze"] = {
    ySplit: 1,
    topLeftCell: "A2",
    activePane: "bottomLeft",
    state: "frozen",
  };

  AUTHORIZED_POSITION_EXPORT_HEADERS.forEach((_, column) => {
    const cell = authorizedSheet[
      XLSX.utils.encode_cell({ r: 0, c: column })
    ] as any;
    cell.s = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { patternType: "solid", fgColor: { rgb: "0F172A" } },
      alignment: {
        horizontal: column < 3 ? "left" : "center",
        vertical: "center",
        wrapText: true,
      },
      border: BORDER,
    };
  });

  authorizedRows.forEach((_, rowIndex) => {
    for (let column = 0; column < 6; column += 1) {
      const cell = authorizedSheet[
        XLSX.utils.encode_cell({ r: rowIndex + 1, c: column })
      ] as any;
      if (!cell) continue;
      const hasVacancy = authorizedPositions[rowIndex]?.vacant > 0;
      cell.s = {
        ...(hasVacancy
          ? { fill: { patternType: "solid", fgColor: { rgb: "DCFCE7" } } }
          : rowIndex % 2 === 1
          ? { fill: { patternType: "solid", fgColor: { rgb: "F8FAFC" } } }
          : {}),
        ...(hasVacancy && column === 5
          ? { font: { bold: true, color: { rgb: "15803D" } } }
          : {}),
        alignment: {
          horizontal: column < 3 ? "left" : "right",
          vertical: "center",
        },
        border: BORDER,
      };
    }
  });
  const authorizedTotalRowIndex = authorizedRows.length + 1;
  for (let column = 0; column < 6; column += 1) {
    const cell = authorizedSheet[
      XLSX.utils.encode_cell({ r: authorizedTotalRowIndex, c: column })
    ] as any;
    if (!cell) continue;
    cell.s = {
      font: { bold: true, color: { rgb: "0F172A" } },
      fill: { patternType: "solid", fgColor: { rgb: "E2E8F0" } },
      alignment: {
        horizontal: column < 3 ? "left" : "right",
        vertical: "center",
      },
      border: BORDER,
    };
  }
  XLSX.utils.book_append_sheet(
    workbook,
    authorizedSheet,
    "Authorized Positions"
  );

  XLSX.writeFile(workbook, officeWorkforceExportFilename(generatedAt), {
    compression: true,
  });
}
