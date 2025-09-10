import * as XLSX from "xlsx-js-style";

type Row = {
  Date: string;
  Time: string;
  Name: string;
  Office: string;
  "Employee No": string; // <- display number (digits before comma)
};

export function exportAttendanceExcel(rows: Row[]) {
  // 1) Header row (explicit order)
  const HEADER = ["Date", "Time", "Name", "Office", "Employee No"] as const;
  const ws = XLSX.utils.aoa_to_sheet([HEADER as unknown as string[]]);

  // 2) Append data starting A2 (lock column order with header option)
  XLSX.utils.sheet_add_json(ws, rows, {
    origin: "A2",
    skipHeader: true,
    header: HEADER as unknown as string[],
  });

  // 3) Column widths
  (ws as any)["!cols"] = [
    { wch: 12 }, // Date
    { wch: 10 }, // Time
    { wch: 30 }, // Name
    { wch: 36 }, // Office
    { wch: 14 }, // Employee No
  ];

  // 4) Autofilter (widely supported)
  (ws as any)["!autofilter"] = { ref: "A1:E1" };

  // 5) Try freezing header row (some viewers ignore this)
  (ws as any)["!freeze"] = {
    ySplit: 1,
    xSplit: 0,
    topLeftCell: "A2",
    activePane: "bottomLeft",
    state: "frozen",
  };

  // 6) Style header cells A1:E1 (ensure the cells exist, then style)
  const headerAddrs = ["A1", "B1", "C1", "D1", "E1"];
  headerAddrs.forEach((addr, i) => {
    if (!(ws as any)[addr]) (ws as any)[addr] = { t: "s", v: HEADER[i] };
    const cell: any = (ws as any)[addr];
    cell.s = {
      font: { bold: true, color: { rgb: "1F2937" } },             // slate-800
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      fill: { patternType: "solid", fgColor: { rgb: "F3F4F6" } }, // gray-100
      border: {
        top:    { style: "thin", color: { rgb: "D1D5DB" } },
        bottom: { style: "thin", color: { rgb: "D1D5DB" } },
        left:   { style: "thin", color: { rgb: "D1D5DB" } },
        right:  { style: "thin", color: { rgb: "D1D5DB" } },
      },
    };
  });

  // Header row height
  (ws as any)["!rows"] = [{ hpt: 24 }];

  // 7) Zebra rows + borders + alignment
  const ref = ws["!ref"] as string;
  if (ref) {
    const range = XLSX.utils.decode_range(ref);
    for (let R = 1; R <= range.e.r; R++) { // start at row index 1 => Excel row 2
      const zebra = R % 2 === 1;
      for (let C = 0; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell: any = (ws as any)[addr];
        if (!cell) continue;

        cell.s = {
          alignment: { vertical: "center" },
          border: {
            top:    { style: "hair", color: { rgb: "E5E7EB" } },
            bottom: { style: "hair", color: { rgb: "E5E7EB" } },
            left:   { style: "hair", color: { rgb: "E5E7EB" } },
            right:  { style: "hair", color: { rgb: "E5E7EB" } },
          },
          ...(zebra ? { fill: { patternType: "solid", fgColor: { rgb: "FAFAFA" } } } : {}),
        };

        // center Date / Time / Employee No
        if (C === 0 || C === 1 || C === 4) {
          cell.s.alignment = { ...(cell.s.alignment || {}), horizontal: "center" };
        }
        // wrap Office
        if (C === 3) {
          cell.s.alignment = { ...(cell.s.alignment || {}), wrapText: true };
        }
      }
    }
  }

  // 8) Build and save (ensure this is from xlsx-js-style)
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Attendance");
  XLSX.writeFile(wb, `Attendance_${new Date().toISOString().slice(0, 10)}.xlsx`, {
    compression: true,
  });
}
