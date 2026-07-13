import JSZip from "jszip";
import * as XLSX from "xlsx-js-style";

import {
  ATTENDANCE_EXCEPTION_STATUS_LABELS,
  ATTENDANCE_EXCEPTION_TYPE_LABELS,
  buildAnnex8cSummary,
  type AttendanceExceptionStatusCode,
  type AttendanceExceptionTypeCode,
} from "@/lib/attendance-exception";

export type Annex8cExportRow = {
  employeeName: string;
  officeName: string;
  incidentDate: string;
  exceptionType: AttendanceExceptionTypeCode;
  occurrences: number;
  actionTaken: string;
  status: AttendanceExceptionStatusCode;
  remarks: string;
  employeeNo?: string;
  incidentDates?: string;
};

const THIN_BORDER = {
  top: { style: "thin", color: { rgb: "000000" } },
  bottom: { style: "thin", color: { rgb: "000000" } },
  left: { style: "thin", color: { rgb: "000000" } },
  right: { style: "thin", color: { rgb: "000000" } },
} as const;

const TITLE_STYLE = {
  font: { bold: true, sz: 14, name: "Calibri", color: { rgb: "000000" } },
  alignment: { horizontal: "left", vertical: "center" },
} as const;

const SUBTITLE_STYLE = {
  font: { bold: true, sz: 11, name: "Calibri", color: { rgb: "000000" } },
  alignment: { horizontal: "left", vertical: "center" },
} as const;

const HEADER_STYLE = {
  font: { bold: true, sz: 10, name: "Calibri", color: { rgb: "000000" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  fill: { patternType: "solid", fgColor: { rgb: "D9D9D9" } },
  border: THIN_BORDER,
} as const;

const BODY_STYLE = {
  font: { sz: 9, name: "Calibri", color: { rgb: "000000" } },
  alignment: { vertical: "center", wrapText: true },
  border: THIN_BORDER,
} as const;

const BODY_CENTER = {
  ...BODY_STYLE,
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
} as const;

function applyCellStyle(ws: XLSX.WorkSheet, r: number, c: number, style: object) {
  const addr = XLSX.utils.encode_cell({ r, c });
  const cell: any = (ws as any)[addr];
  if (!cell) {
    (ws as any)[addr] = { t: "s", v: "", s: style };
    return;
  }
  cell.s = style;
}

function ensureRange(ws: XLSX.WorkSheet, endR: number, endC: number) {
  ws["!ref"] = `${XLSX.utils.encode_cell({ r: 0, c: 0 })}:${XLSX.utils.encode_cell({ r: endR, c: endC })}`;
}

/**
 * xlsx-js-style does not reliably write Excel print settings.
 * Patch worksheet XML so Print Preview opens as Letter + Fit to Width (+ landscape for Registry).
 */
function injectPrintSettings(xml: string, opts: { landscape: boolean }) {
  const orientation = opts.landscape ? "landscape" : "portrait";

  if (/<sheetPr[\s/>]/.test(xml)) {
    if (/pageSetUpPr/.test(xml)) {
      xml = xml.replace(/<pageSetUpPr\b[^/]*\/>/g, '<pageSetUpPr fitToPage="1"/>');
    } else if (/<sheetPr\b[^>]*\/>/.test(xml)) {
      xml = xml.replace(/<sheetPr\b([^>]*)\/>/, '<sheetPr$1><pageSetUpPr fitToPage="1"/></sheetPr>');
    } else {
      xml = xml.replace(/<sheetPr\b([^>]*)>/, '<sheetPr$1><pageSetUpPr fitToPage="1"/>');
    }
  } else {
    xml = xml.replace(/(<worksheet\b[^>]*>)/, '$1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>');
  }

  xml = xml.replace(/<printOptions\b[^/]*\/>/g, "");
  xml = xml.replace(/<pageMargins\b[^/]*\/>/g, "");
  xml = xml.replace(/<pageSetup\b[^/]*\/>/g, "");

  // paperSize 1 = Letter (matches typical HRMO printers); fitToHeight 0 = unlimited pages tall
  const block = [
    `<printOptions horizontalCentered="1" gridLines="0"/>`,
    `<pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.2" footer="0.2"/>`,
    `<pageSetup paperSize="1" orientation="${orientation}" fitToWidth="1" fitToHeight="0"/>`,
  ].join("");

  return xml.replace(/<\/worksheet>/, `${block}</worksheet>`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function writePrintReadyWorkbook(wb: XLSX.WorkBook, filename: string, landscapeSheets: Set<string>) {
  const raw = XLSX.write(wb, {
    type: "array",
    bookType: "xlsx",
    cellStyles: true,
    compression: true,
  }) as ArrayBuffer;

  const zip = await JSZip.loadAsync(raw);

  // Map sheet names → sheetN.xml via workbook relationships
  const workbookXml = await zip.file("xl/workbook.xml")!.async("string");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels")!.async("string");

  const nameToRid = new Map<string, string>();
  for (const m of workbookXml.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    nameToRid.set(m[1], m[2]);
  }
  const ridToTarget = new Map<string, string>();
  for (const m of relsXml.matchAll(/<Relationship\b[^>]*>/g)) {
    const tag = m[0];
    const id = tag.match(/\bId="([^"]+)"/)?.[1];
    const target = tag.match(/\bTarget="([^"]+)"/)?.[1];
    if (id && target) ridToTarget.set(id, target.replace(/^\//, ""));
  }

  for (const [sheetName, rid] of nameToRid) {
    const target = ridToTarget.get(rid);
    if (!target) continue;
    const path = target.startsWith("xl/") ? target : `xl/${target}`;
    const file = zip.file(path);
    if (!file) continue;
    let xml = await file.async("string");
    xml = injectPrintSettings(xml, { landscape: landscapeSheets.has(sheetName) });
    zip.file(path, xml);
  }

  // Repeat title + header rows on each printed page for Registry
  const registryRid = nameToRid.get("Registry");
  const registryTarget = registryRid ? ridToTarget.get(registryRid) : null;
  if (registryTarget) {
    const local = registryTarget.replace(/^worksheets\//, "").replace(/^\.\//, "");
    const definedName = `<definedName name="_xlnm.Print_Titles" localSheetId="0">'Registry'!$1:$4</definedName>`;
    let wbXml = workbookXml;
    if (wbXml.includes("<definedNames>")) {
      if (!wbXml.includes("_xlnm.Print_Titles")) {
        wbXml = wbXml.replace("<definedNames>", `<definedNames>${definedName}`);
      }
    } else {
      wbXml = wbXml.replace("</workbook>", `<definedNames>${definedName}</definedNames></workbook>`);
    }
    // local unused but kept for clarity if we need sheet-specific later
    void local;
    zip.file("xl/workbook.xml", wbXml);
  }

  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, filename);
}

function buildRegistrySheet(rows: Annex8cExportRow[], reportingPeriod: string) {
  const header = [
    "No.",
    "Employee Name",
    "Office/Department",
    "Date of Incident",
    "Type of Attendance Exception",
    "No. of Occurrences",
    "Action Taken",
    "Status",
    "Remarks",
  ];

  const body = rows.map((r, i) => [
    i + 1,
    r.employeeName,
    r.officeName,
    r.incidentDate,
    `${r.exceptionType} — ${ATTENDANCE_EXCEPTION_TYPE_LABELS[r.exceptionType]}`,
    r.occurrences,
    r.actionTaken || "",
    ATTENDANCE_EXCEPTION_STATUS_LABELS[r.status] ?? r.status,
    r.remarks || "",
  ]);

  const aoa: (string | number)[][] = [
    ["Annex 8-C: Attendance Exception Registry"],
    [`Reporting Period: ${reportingPeriod}`],
    [],
    header,
    ...body,
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const lastCol = header.length - 1;
  const headerRow = 3;
  const lastRow = Math.max(headerRow, headerRow + body.length);

  ensureRange(ws, lastRow, lastCol);

  applyCellStyle(ws, 0, 0, TITLE_STYLE);
  applyCellStyle(ws, 1, 0, SUBTITLE_STYLE);
  (ws as any)["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } },
  ];

  for (let c = 0; c <= lastCol; c++) applyCellStyle(ws, headerRow, c, HEADER_STYLE);

  for (let r = headerRow + 1; r <= lastRow; r++) {
    for (let c = 0; c <= lastCol; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!(ws as any)[addr]) (ws as any)[addr] = { t: "s", v: "" };
      applyCellStyle(ws, r, c, c === 0 || c === 5 ? BODY_CENTER : BODY_STYLE);
    }
  }

  // Compact widths so Letter landscape + Fit to 1 page wide works well
  (ws as any)["!cols"] = [
    { wch: 4 },
    { wch: 24 },
    { wch: 22 },
    { wch: 28 },
    { wch: 26 },
    { wch: 8 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
  ];
  (ws as any)["!rows"] = [{ hpt: 20 }, { hpt: 16 }, { hpt: 6 }, { hpt: 30 }];

  return ws;
}

function buildSummarySheet(
  summary: ReturnType<typeof buildAnnex8cSummary>,
  reportingPeriod: string
) {
  const indicatorHeader = ["Indicator", "Total"];
  const indicators: (string | number)[][] = [
    ["Employees with Attendance Exceptions", summary.employeesWithExceptions],
    ["Tardiness Incidents", summary.tardinessIncidents],
    ["Undertime Incidents", summary.undertimeIncidents],
    ["Missing DTR Incidents", summary.missingDtrIncidents],
    ["Unauthorized Absences", summary.unauthorizedAbsences],
    ["AWOL Cases", summary.awolCases],
    ["Habitual Tardiness Cases", summary.habitualTardinessCases],
    ["Failure to Submit DTR", summary.failureToSubmitDtr],
  ];

  const typeHeader = ["Code", "Meaning"];
  const types: (string | number)[][] = [
    ["T", ATTENDANCE_EXCEPTION_TYPE_LABELS.T],
    ["U", ATTENDANCE_EXCEPTION_TYPE_LABELS.U],
    ["MD", ATTENDANCE_EXCEPTION_TYPE_LABELS.MD],
    ["FD", ATTENDANCE_EXCEPTION_TYPE_LABELS.FD],
    ["UA", ATTENDANCE_EXCEPTION_TYPE_LABELS.UA],
    ["AWOL", ATTENDANCE_EXCEPTION_TYPE_LABELS.AWOL],
  ];

  const statusHeader = ["Status", "Meaning"];
  const statuses: (string | number)[][] = [
    ["Open", "Under monitoring or verification"],
    ["Counseling Conducted", "Employee has been counseled"],
    ["Memorandum Issued", "Formal memorandum issued"],
    ["Resolved", "Attendance issue resolved"],
    ["For Administrative Action", "Referred for further action"],
  ];

  const aoa: (string | number)[][] = [
    ["Attendance Monitoring Summary"],
    [`Reporting Period: ${reportingPeriod}`],
    [],
    indicatorHeader,
    ...indicators,
    [],
    ["Type Guide"],
    typeHeader,
    ...types,
    [],
    ["Status Guide"],
    statusHeader,
    ...statuses,
    [],
    ["Definition of Habitual Tardiness"],
    [
      `An employee may be considered habitually tardy based on applicable CSC rules and regulations. Helper threshold used here: ≥ ${summary.habitualThreshold} late days in the reporting period.`,
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  applyCellStyle(ws, 0, 0, TITLE_STYLE);
  applyCellStyle(ws, 1, 0, SUBTITLE_STYLE);

  const styleTable = (headerRow: number, rowCount: number, cols: number) => {
    for (let c = 0; c < cols; c++) applyCellStyle(ws, headerRow, c, HEADER_STYLE);
    for (let r = headerRow + 1; r <= headerRow + rowCount; r++) {
      for (let c = 0; c < cols; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!(ws as any)[addr]) (ws as any)[addr] = { t: "s", v: "" };
        applyCellStyle(ws, r, c, c === 1 ? BODY_CENTER : BODY_STYLE);
      }
    }
  };

  styleTable(3, indicators.length, 2);
  styleTable(3 + indicators.length + 3, types.length, 2);
  styleTable(3 + indicators.length + 3 + types.length + 3, statuses.length, 2);

  applyCellStyle(ws, 3 + indicators.length + 2, 0, SUBTITLE_STYLE);
  applyCellStyle(ws, 3 + indicators.length + 3 + types.length + 2, 0, SUBTITLE_STYLE);
  applyCellStyle(ws, aoa.length - 2, 0, SUBTITLE_STYLE);

  (ws as any)["!cols"] = [{ wch: 42 }, { wch: 48 }];
  (ws as any)["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
    { s: { r: aoa.length - 1, c: 0 }, e: { r: aoa.length - 1, c: 1 } },
  ];

  return ws;
}

/** Build and download a print-ready Annex 8-C workbook (Letter, Fit to Width, bold headers, grid). */
export async function exportAnnex8cExcel(rows: Annex8cExportRow[], reportingPeriod: string) {
  const wb = XLSX.utils.book_new();
  const summary = buildAnnex8cSummary(
    rows.map((r) => ({
      employeeName: r.employeeName,
      employeeNo: r.employeeNo ?? "",
      exceptionType: r.exceptionType,
      incidentDate: r.incidentDate,
      incidentDates: r.incidentDates ?? r.incidentDate,
      occurrences: r.occurrences,
    }))
  );

  XLSX.utils.book_append_sheet(wb, buildRegistrySheet(rows, reportingPeriod), "Registry");
  XLSX.utils.book_append_sheet(wb, buildSummarySheet(summary, reportingPeriod), "Summary");

  const safePeriod = reportingPeriod.replace(/[^\w.-]+/g, "_");
  await writePrintReadyWorkbook(
    wb,
    `Annex_8-C_Attendance_Exception_Registry_${safePeriod}.xlsx`,
    new Set(["Registry"])
  );
}
