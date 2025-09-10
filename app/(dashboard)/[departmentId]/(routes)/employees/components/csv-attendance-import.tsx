"use client";

import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import * as XLSX from "xlsx-js-style";

import { parseIdFromText } from "@/lib/parseEmployeeIdFromText";

// Types for mapping
type Mapping = {
  scanText?: string;   // column that contains the QR scan free-text
  idColumn?: string;   // OR direct column that *is* the ID
  timestamp?: string;  // full timestamp column
  date?: string;       // date column
  time?: string;       // time column
};

type ParsedRow = Record<string, string>;

export default function CsvAttendanceImport() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [idType, setIdType] = useState<"employeeId" | "employeeNo">("employeeId");
  const [regex, setRegex] = useState<string>(""); // optional custom regex with group 1 as ID
  const [preview, setPreview] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse<ParsedRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const data = res.data as ParsedRow[];
        setRows(data);
        const hdrs = res.meta.fields || Object.keys(data[0] || {});
        setHeaders(hdrs);
        // naive auto-guess
        const guess: Mapping = {};
        const lower = (s: string) => s.toLowerCase();
        for (const h of hdrs) {
          const lh = lower(h);
          if (!guess.scanText && /(text|scan|content|payload)/.test(lh)) guess.scanText = h;
          if (!guess.timestamp && /(timestamp|datetime|scanned|time)/.test(lh)) guess.timestamp = h;
          if (!guess.date && /(date)/.test(lh)) guess.date = h;
          if (!guess.time && /(^|[^a-z])time([^a-z]|$)/.test(lh)) guess.time = h;
          if (!guess.idColumn && /(id|employee.?no)/.test(lh)) guess.idColumn = h;
        }
        setMapping((m) => ({ ...m, ...guess }));
      },
    });
  }

  function toDisplayEmployeeNo(val?: string) {
    // take text before comma, then keep digits only
    const left = (val ?? "").split(",")[0].trim();
    const digitsOnly = (left.match(/\d+/g)?.join("") ?? "");
    return digitsOnly;
  }

  function buildPayload() {
    const customRe = regex ? new RegExp(regex) : undefined;
    const payloadRows = rows.map((r) => {
      const idRaw = mapping.scanText ? (r[mapping.scanText] || "") : undefined;
      let id: string | undefined = undefined;

      if (mapping.idColumn && r[mapping.idColumn]) {
        const raw = String(r[mapping.idColumn]).trim();
        // If it's already a bare UUID/number, keep it; else parse like scan text
        if (/^([0-9a-fA-F-]{36})$/.test(raw) || /^\d+$/.test(raw)) {
          id = raw;
        } else {
          id = parseIdFromText(raw, customRe).id ?? undefined;
        }
      } else if (mapping.scanText && r[mapping.scanText]) {
        const raw = String(r[mapping.scanText]).trim();
        id = parseIdFromText(raw, customRe).id ?? undefined;
      }



      const timestamp = mapping.timestamp ? r[mapping.timestamp] : undefined;
      const date = mapping.date ? r[mapping.date] : undefined;
      const time = mapping.time ? r[mapping.time] : undefined;

      return { idRaw, id, timestamp, date, time, source: "csv" };
    });
    return payloadRows;
  }

  async function resolvePreview() {
    const payloadRows = buildPayload();
    const res = await fetch("/api/import/attendance/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idType, rows: payloadRows, regex: regex || undefined }),
    });
    const json = await res.json();
    if (json.ok) setPreview(json.rows);
  }
function exportExcel() {
  if (!preview.length) return;

  // Build rows with the exact header keys we want to see in Excel
  const rows = preview.map((r) => ({
    Date: r.date,
    Time: r.time,
    "Employee No": toDisplayEmployeeNo(r.employeeNo),
    Name: r.name,
    Office: r.office,
  }));

  // 1) Header row (fixed order)
  const HEADER = ["Date", "Time", "Name", "Office", "Employee No"] as const;
  const ws = XLSX.utils.aoa_to_sheet([HEADER as unknown as string[]]);

  // 2) Append data starting at A2 (this API supports origin)
  XLSX.utils.sheet_add_json(ws, rows, {
    origin: "A2",
    skipHeader: true,
    header: HEADER as unknown as string[],
  });

  // 3) Column widths
  (ws as any)["!cols"] = [
    { wch: 12 }, // Date
    { wch: 10 }, // Time
    { wch: 28 }, // Name
    { wch: 36 }, // Office
    { wch: 14 }, // Employee No
  ];

  // 4) Freeze header row + autofilter
  (ws as any)["!freeze"] = {
    ySplit: 1,
    xSplit: 0,
    topLeftCell: "A2",
    activePane: "bottomLeft",
    state: "frozen",
  };
  (ws as any)["!autofilter"] = { ref: "A1:E1" };

  // 5) Style header cells (A1:E1)
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
  (ws as any)["!rows"] = [{ hpt: 24 }]; // header height

  // 6) Zebra striping + borders + alignment
  const ref = ws["!ref"] as string;
  if (ref) {
    const range = XLSX.utils.decode_range(ref);
    for (let R = 1; R <= range.e.r; R++) { // start at row 2
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

        // Center Date / Time / Employee No
        if (C === 0 || C === 1 || C === 4) {
          cell.s.alignment = { ...(cell.s.alignment || {}), horizontal: "center" };
        }
        // Wrap Office column
        if (C === 3) {
          cell.s.alignment = { ...(cell.s.alignment || {}), wrapText: true };
        }
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Attendance");
  XLSX.writeFile(wb, `Attendance_${new Date().toISOString().slice(0, 10)}.xlsx`, {
    compression: true,
  });
}


  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>CSV Attendance Import</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Input type="file" accept=".csv" ref={fileRef} onChange={onFile} />
            <Select value={idType} onValueChange={(v: any) => setIdType(v)}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="ID Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="employeeId">employee.id (UUID)</SelectItem>
                <SelectItem value="employeeNo">employee.employeeNo (Number)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!!headers.length && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Scan Text Column (contains the QR payload)</div>
                <Select value={mapping.scanText} onValueChange={(v) => setMapping(m => ({ ...m, scanText: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                  <SelectContent>
                    {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground">Optional if you already have a pure ID column.</div>
                <div className="text-sm font-medium mt-3">OR Direct ID Column</div>
                <Select value={mapping.idColumn} onValueChange={(v) => setMapping(m => ({ ...m, idColumn: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                  <SelectContent>
                    {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground">If provided, we skip regex/scan text parsing.</div>

                <div className="text-sm font-medium mt-3">Custom Regex (optional)</div>
                <Input
                  placeholder="e.g. employee\\/(\\w[\\w-]+) or id=(\\w+)"
                  value={regex}
                  onChange={(e) => setRegex(e.target.value)}
                />
                <div className="text-xs text-muted-foreground">Must include a capturing group for the ID (group 1).</div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Timestamp Column</div>
                <Select value={mapping.timestamp} onValueChange={(v) => setMapping(m => ({ ...m, timestamp: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                  <SelectContent>
                    {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground">If your CSV has a single date-time field.</div>

                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <div className="text-sm font-medium">Date Column</div>
                    <Select value={mapping.date} onValueChange={(v) => setMapping(m => ({ ...m, date: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Time Column</div>
                    <Select value={mapping.time} onValueChange={(v) => setMapping(m => ({ ...m, time: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">If you set Date+Time, Timestamp is ignored.</div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={resolvePreview} disabled={!headers.length}>Preview</Button>
            <Button variant="outline" onClick={exportExcel} disabled={!preview.length}>Export to Excel</Button>
          </div>

          {!!preview.length && (
            <div className="mt-4 border rounded-md overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-muted">
  <tr>
    {["Date","Time","Name","Office","Employee No","Matched"].map(h => (
      <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
    ))}
  </tr>
</thead>
                <tbody>
                  {preview.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-1">{r.date}</td>
                      <td className="px-3 py-1">{r.time}</td>
                      <td className="px-3 py-1">{toDisplayEmployeeNo(r.employeeNo)}</td>
                      <td className="px-3 py-1">{r.name}</td>
                      <td className="px-3 py-1">{r.office}</td>

                      <td className="px-3 py-1">{r.idMatched ? "✅" : "❌"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-3 py-2 text-xs text-muted-foreground">Showing first 50 rows.</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}