"use client";

import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import * as XLSX from "xlsx-js-style";
import { toast } from "sonner";
import { Loader2, UploadCloud, X, Check, Undo2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useParams } from "next/navigation";

import { parseIdFromText } from "@/lib/parseEmployeeIdFromText";
import { cn } from "@/lib/utils";


type MappingByFile = Record<string, Mapping>;
const MAP_ALL = "_ALL_";

type Acc = { name: string; office: string; empNo: string; minutes: number[] };



function guessMappingFromHeaders(hdrs: string[]): Mapping {
  const guess: Mapping = {};
  const lower = (s: string) => s.toLowerCase();

  for (const h of hdrs) {
    const lh = lower(h);
    if (!guess.scanText && /(text|scan|content|payload)/.test(lh)) guess.scanText = h;
    if (!guess.timestamp && /(timestamp|datetime|scanned.*time|time stamp|scannedtime|time)/.test(lh)) guess.timestamp = h;
    if (!guess.date && /\bdate\b/.test(lh)) guess.date = h;
    if (!guess.time && /\btime\b/.test(lh)) guess.time = h;
    if (!guess.idColumn && /(id|employee.?no)/.test(lh)) guess.idColumn = h;
  }
  return guess;
}


type ParsedFile = { name: string; headers: string[]; rows: ParsedRow[]; count: number };


// Types for mapping
type Mapping = {
  scanText?: string;   // column that contains the QR scan free-text
  idColumn?: string;   // OR direct column that *is* the ID
  timestamp?: string;  // full timestamp column
  date?: string;       // date column
  time?: string;       // time column
};

type ParsedRow = Record<string, string>;
type CategoryKey = "E" | "P" | "CT_COS" | "C" | "JO";
type OfficeSummaryRow = {
  office: string;
  counts: Record<CategoryKey, number>;
  total: number;
  attendance: Record<CategoryKey, number>;
  attendanceTotal: number;
};

const CATEGORY_ORDER: CategoryKey[] = ["E", "P", "CT_COS", "C", "JO"];
const CATEGORY_LABEL: Record<CategoryKey, string> = {
  E: "E",
  P: "P",
  CT_COS: "CT/COS",
  C: "C",
  JO: "JO",
};

const OFFICE_UNKNOWN = "Unassigned / No Office";

const normalizeOfficeName = (name?: string | null) => {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : OFFICE_UNKNOWN;
};

const mapEmployeeTypeToCategory = (name?: string | null): CategoryKey => {
  const normalized = (name || "").toLowerCase();
  if (normalized.includes("elective")) return "E";
  if (
    normalized.includes("job order") ||
    normalized.includes("job-order") ||
    normalized.includes("joborder") ||
    normalized === "jo"
  ) {
    return "JO";
  }
  if (normalized.includes("casual") || normalized.includes("temporary")) return "C";
  if (
    normalized.includes("co-term") ||
    normalized.includes("coterminous") ||
    normalized.includes("co-terminous") ||
    normalized.includes("contract of service") ||
    normalized.includes("contractual") ||
    normalized.includes("cos")
  ) {
    return "CT_COS";
  }
  if (normalized.includes("permanent") || normalized.includes("regular")) return "P";
  return "P";
};

type AbsentEmployee = {
  employeeId: string;
  employeeNo: string;
  name: string;
  office: string;
  employeeTypeName: string;
  position?: string;
};

const createEmptyCounts = (): Record<CategoryKey, number> =>
  CATEGORY_ORDER.reduce(
    (acc, key) => {
      acc[key] = 0;
      return acc;
    },
    {} as Record<CategoryKey, number>
  );

export default function CsvAttendanceImport() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [idType, setIdType] = useState<"employeeId" | "employeeNo">("employeeId");
  const [regex, setRegex] = useState<string>("");
  const [preview, setPreview] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [isParsing, setIsParsing] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [filesInfo, setFilesInfo] = useState<ParsedFile[]>([]);
  const [dedup, setDedup] = useState(true);

  const [mappingByFile, setMappingByFile] = useState<MappingByFile>({});
  const [mapTarget, setMapTarget] = useState<string>(MAP_ALL); // which file you're editing
  const [officeSummary, setOfficeSummary] = useState<OfficeSummaryRow[]>([]);
  const [absentEmployees, setAbsentEmployees] = useState<AbsentEmployee[]>([]);
  const [manuallyCheckedAbsentees, setManuallyCheckedAbsentees] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"preview" | "summary" | "absentees">("preview");
  const [isDragging, setIsDragging] = useState(false);

  const params = useParams<{ departmentId: string }>();
  const departmentId =
    typeof params?.departmentId === "string" ? params.departmentId : "";

  const summaryTotals = useMemo(() => {
    const totalCounts = createEmptyCounts();
    const attendanceCounts = createEmptyCounts();
    let total = 0;
    let attendanceTotal = 0;

    for (const row of officeSummary) {
      CATEGORY_ORDER.forEach((cat) => {
        totalCounts[cat] += row.counts[cat];
        attendanceCounts[cat] += row.attendance[cat];
      });
      total += row.total;
      attendanceTotal += row.attendanceTotal;
    }

    return {
      counts: totalCounts,
      attendance: attendanceCounts,
      total,
      attendanceTotal,
    };
  }, [officeSummary]);

  const getAbsentKey = (emp: AbsentEmployee) =>
    emp.employeeId && emp.employeeId.length ? emp.employeeId : `empno:${emp.employeeNo}`;

  const pendingAbsentees = useMemo(
    () =>
      absentEmployees.filter((emp) => {
        const key = getAbsentKey(emp);
        return !manuallyCheckedAbsentees[key];
      }),
    [absentEmployees, manuallyCheckedAbsentees]
  );

  const manuallyMarkedAbsentees = useMemo(
    () =>
      absentEmployees.filter((emp) => {
        const key = getAbsentKey(emp);
        return !!manuallyCheckedAbsentees[key];
      }),
    [absentEmployees, manuallyCheckedAbsentees]
  );


  function toDisplayEmployeeNo(val?: string) {
    // take text before comma, then keep digits only
    const left = (val ?? "").split(",")[0].trim();
    const digitsOnly = (left.match(/\d+/g)?.join("") ?? "");
    return digitsOnly;
  }

  async function processFileList(list: File[]) {
    setOfficeSummary([]);
    setAbsentEmployees([]);
    setManuallyCheckedAbsentees({});
    setActiveTab("preview");

    const csvFiles = list.filter((file) => {
      const lower = file.name.toLowerCase();
      return file.type === "text/csv" || lower.endsWith(".csv");
    });

    if (!csvFiles.length) {
      toast.error("No CSV files detected in selection");
      return;
    }

    const t = toast.loading("Parsing CSV files...");
    setIsParsing(true);
    try {
      const parsed = await Promise.all(csvFiles.map(parseCsv));

      const byName = new Map<string, ParsedFile>();
      for (const f of filesInfo) byName.set(f.name, f);
      for (const p of parsed) byName.set(p.name, p);

      const next = Array.from(byName.values());
      setFilesInfo(next);
      recomputeFromFiles(next);

      const rowsAdded = parsed.reduce((sum, file) => sum + file.count, 0);
      toast.success(`Added ${rowsAdded.toLocaleString()} rows from ${parsed.length} file(s)`, { id: t });
    } catch (err) {
      console.error(err);
      toast.error("Failed to parse one or more files", { id: t });
    } finally {
      setIsParsing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files || []);
    if (!list.length) return;
    await processFileList(list);
  }


  function clearFile() {
    if (fileRef.current) fileRef.current.value = "";
    setFileName("");
    setHeaders([]);
    setRows([]);
    setMapping({});
    setPreview([]);
    setFilesInfo([]);
    setOfficeSummary([]);
    setActiveTab("preview");
    toast.message("File cleared");
  }
  function safeRegex(s?: string): RegExp | undefined {
    if (!s?.trim()) return undefined;
    try { return new RegExp(s, "i"); } catch { return undefined; }
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (isParsing) return;
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    const related = event.relatedTarget as Node | null;
    if (related && event.currentTarget.contains(related)) return;
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (isParsing) return;
    setIsDragging(false);
    const list = Array.from(event.dataTransfer.files || []);
    if (!list.length) return;
    void processFileList(list);
  };

  function buildPayload() {
    const customRe = safeRegex(regex);

    return rows.map((r) => {
      const src = (r as any).__source as string | undefined;
      const m: Mapping = (src && mappingByFile[src]) ? mappingByFile[src] : mapping;

      const idRaw = m.scanText ? (r[m.scanText] || "") : undefined;
      let id: string | undefined;

      if (m.idColumn && r[m.idColumn]) {
        const raw = String(r[m.idColumn]).trim();
        if (/^([0-9a-fA-F-]{36})$/.test(raw) || /^\d+$/.test(raw)) id = raw;
        else id = parseIdFromText(raw, customRe).id ?? undefined;
      } else if (idRaw) {
        const raw = String(idRaw).trim();
        id = parseIdFromText(raw, customRe).id ?? undefined;
      }


      const timestamp = m.timestamp ? r[m.timestamp] : undefined;
      const date = m.date ? r[m.date] : undefined;
      const time = m.time ? r[m.time] : undefined;

      return { idRaw, id, timestamp, date, time, source: src || "csv" };
    });
  }



  async function resolvePreview() {
    if (!departmentId) {
      toast.error("Missing department context");
      return;
    }

    const filesMissingId = filesInfo.filter(f => {
      const m = mappingByFile[f.name] || mapping;
      return !m.idColumn && !m.scanText;
    });
    if (filesMissingId.length) {
      toast.warning(`No ID mapping for: ${filesMissingId.map(f => f.name).join(", ")}`);
    }
    const payloadRows = buildPayload();
    const t = toast.loading("Resolving employees...");
    setIsPreviewing(true);
    setOfficeSummary([]);
    setAbsentEmployees([]);
    setManuallyCheckedAbsentees({});
    setActiveTab("preview");
    try {
      const res = await fetch("/api/import/attendance/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentId,
          idType,
          rows: payloadRows,
          regex: regex || undefined,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        let rowsOut = json.rows as any[];

        if (dedup) {
          const seen = new Set<string>();
          rowsOut = rowsOut.filter(r => {
            const idPart = r.employeeId || r.employeeNo || r.id || "";
            const key = `${idPart}|${r.date}|${r.time}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        }

        setPreview(rowsOut);
        setOfficeSummary((json.officeSummary ?? []) as OfficeSummaryRow[]);
        setAbsentEmployees((json.absentEmployees ?? []) as AbsentEmployee[]);
        setManuallyCheckedAbsentees({});

        const matched = rowsOut.filter((r: any) => r.idMatched).length;
        const removed = json.rows.length - rowsOut.length;
        toast.success(
          `Preview ready - ${matched}/${rowsOut.length} matched${dedup && removed > 0 ? `, removed ${removed} duplicate(s)` : ""}`,
          { id: t }
        );
      } else {
        toast.error(json.error || "Failed to resolve", { id: t });
      }
    } catch (e) {
      toast.error("Network error while resolving", { id: t });
    } finally {
      setIsPreviewing(false);
    }
  }

  function parseCsv(file: File): Promise<ParsedFile> {
    return new Promise((resolve, reject) => {
      Papa.parse<ParsedRow>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => {
          const rows = res.data as ParsedRow[];
          const headers = res.meta.fields || Object.keys(rows[0] || {});
          resolve({ name: file.name, headers, rows, count: rows.length });
        },
        error: (err) => reject(err),
      });
    });
  }

  function exportExcel() {
    if (!preview.length || isExporting) return;
    setIsExporting(true);
    const t = toast.loading("Exporting Excel...");

    try {
      const rows = preview.map((r) => ({
        Date: r.date,
        Time: r.time,
        Name: r.name,
        Office: r.office,
        "Employee No": toDisplayEmployeeNo(r.employeeNo),
      }));

      // --- styled export with frozen header + autofilter ---
      const HEADER = ["Date", "Time", "Employee No", "Name", "Office",] as const;
      const ws = XLSX.utils.aoa_to_sheet([HEADER as unknown as string[]]);
      XLSX.utils.sheet_add_json(ws, rows, {
        origin: "A2",
        skipHeader: true,
        header: HEADER as unknown as string[],
      });
      (ws as any)["!cols"] = [
        { wch: 12 }, // Date
        { wch: 10 }, // Time
        { wch: 10 }, // Employee No
        { wch: 28 }, // Name
        { wch: 36 },
      ];
      (ws as any)["!autofilter"] = { ref: "A1:E1" };
      (ws as any)["!freeze"] = { ySplit: 1, xSplit: 0, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };
      const headerAddrs = ["A1", "B1", "C1", "D1", "E1"];
      headerAddrs.forEach((addr, i) => {
        if (!(ws as any)[addr]) (ws as any)[addr] = { t: "s", v: HEADER[i] };
        const cell: any = (ws as any)[addr];
        cell.s = {
          font: { bold: true, color: { rgb: "1F2937" } },
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          fill: { patternType: "solid", fgColor: { rgb: "F3F4F6" } },
          border: {
            top: { style: "thin", color: { rgb: "D1D5DB" } },
            bottom: { style: "thin", color: { rgb: "D1D5DB" } },
            left: { style: "thin", color: { rgb: "D1D5DB" } },
            right: { style: "thin", color: { rgb: "D1D5DB" } },
          },
        };
      });
      (ws as any)["!rows"] = [{ hpt: 24 }];

      const ref = ws["!ref"] as string;
      if (ref) {
        const range = XLSX.utils.decode_range(ref);
        for (let R = 1; R <= range.e.r; R++) {
          const zebra = R % 2 === 1;
          for (let C = 0; C <= range.e.c; C++) {
            const addr = XLSX.utils.encode_cell({ r: R, c: C });
            const cell: any = (ws as any)[addr];
            if (!cell) continue;
            cell.s = {
              alignment: { vertical: "center" },
              border: {
                top: { style: "hair", color: { rgb: "E5E7EB" } },
                bottom: { style: "hair", color: { rgb: "E5E7EB" } },
                left: { style: "hair", color: { rgb: "E5E7EB" } },
                right: { style: "hair", color: { rgb: "E5E7EB" } },
              },
              ...(zebra ? { fill: { patternType: "solid", fgColor: { rgb: "FAFAFA" } } } : {}),
            };
            if (C === 0 || C === 1 || C === 2) {   // center Date, Time, Employee No
              cell.s.alignment = { ...(cell.s.alignment || {}), horizontal: "center" };
            }
            if (C === 3) {
              cell.s.alignment = { ...(cell.s.alignment || {}), wrapText: true };
            }
          }
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Attendance");
       // --- SUMMARY (new) ---
    const summary = buildDailySummary(preview);
    if (summary.length) {
      const HEAD2 = [
        "Date","Name","Office","Employee No","First In","Last Out","Total (mins)","Tardy (mins)","Undertime (mins)"
      ] as const;

      const ws2 = XLSX.utils.aoa_to_sheet([HEAD2 as unknown as string[]]);
      XLSX.utils.sheet_add_json(ws2, summary, {
        origin: "A2",
        skipHeader: true,
        header: HEAD2 as unknown as string[],
      });

      (ws2 as any)["!cols"] = [
        { wch: 12 }, { wch: 28 }, { wch: 32 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
      ];
      (ws2 as any)["!autofilter"] = { ref: "A1:I1" };
      (ws2 as any)["!freeze"] = { ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };

      const hdr2 = Array.from({ length: HEAD2.length }, (_, i) => XLSX.utils.encode_cell({ r: 0, c: i }));
      for (const addr of hdr2) {
        const cell: any = (ws2 as any)[addr];
        cell.s = {
          font: { bold: true, color: { rgb: "1F2937" } },
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          fill: { patternType: "solid", fgColor: { rgb: "F3F4F6" } },
          border: { top:{style:"thin",color:{rgb:"D1D5DB"}}, bottom:{style:"thin",color:{rgb:"D1D5DB"}},
                    left:{style:"thin",color:{rgb:"D1D5DB"}}, right:{style:"thin",color:{rgb:"D1D5DB"}} },
        };
      }
      (ws2 as any)["!rows"] = [{ hpt: 24 }];

      const ref2 = ws2["!ref"] as string;
      if (ref2) {
        const rg2 = XLSX.utils.decode_range(ref2);
        for (let R = 1; R <= rg2.e.r; R++) {
          const zebra = R % 2 === 1;
          for (let C = 0; C <= rg2.e.c; C++) {
            const addr = XLSX.utils.encode_cell({ r: R, c: C });
            const cell: any = (ws2 as any)[addr];
            if (!cell) continue;
            cell.s = {
              alignment: { vertical: "center" },
              border: { top:{style:"hair",color:{rgb:"E5E7EB"}}, bottom:{style:"hair",color:{rgb:"E5E7EB"}},
                        left:{style:"hair",color:{rgb:"E5E7EB"}}, right:{style:"hair",color:{rgb:"E5E7EB"}} },
              ...(zebra ? { fill: { patternType: "solid", fgColor: { rgb: "FAFAFA" } } } : {}),
            };
            // center numeric/time columns: Employee No (3), First In (4), Last Out (5), Total (6), Tardy (7), Undertime (8)
            if ([3,4,5,6,7,8].includes(C)) {
              cell.s.alignment = { ...(cell.s.alignment || {}), horizontal: "center" };
            }
          }
        }
      }

      XLSX.utils.book_append_sheet(wb, ws2, "Daily Summary");
    }
    if (officeSummary.length) {
      const OFFICE_HEADERS = [
        "Office",
        "E",
        "P",
        "CT/COS",
        "C",
        "JO",
        "Total",
        "Attended E",
        "Attended P",
        "Attended CT/COS",
        "Attended C",
        "Attended JO",
        "Attendance Total",
        "Variance",
      ] as const;

      const officeRows = officeSummary.map((row) => ({
        Office: row.office,
        E: row.counts.E,
        P: row.counts.P,
        "CT/COS": row.counts.CT_COS,
        C: row.counts.C,
        JO: row.counts.JO,
        Total: row.total,
        "Attended E": row.attendance.E,
        "Attended P": row.attendance.P,
        "Attended CT/COS": row.attendance.CT_COS,
        "Attended C": row.attendance.C,
        "Attended JO": row.attendance.JO,
        "Attendance Total": row.attendanceTotal,
        Variance: row.total - row.attendanceTotal,
      }));

      officeRows.push({
        Office: "Grand total",
        E: summaryTotals.counts.E,
        P: summaryTotals.counts.P,
        "CT/COS": summaryTotals.counts.CT_COS,
        C: summaryTotals.counts.C,
        JO: summaryTotals.counts.JO,
        Total: summaryTotals.total,
        "Attended E": summaryTotals.attendance.E,
        "Attended P": summaryTotals.attendance.P,
        "Attended CT/COS": summaryTotals.attendance.CT_COS,
        "Attended C": summaryTotals.attendance.C,
        "Attended JO": summaryTotals.attendance.JO,
        "Attendance Total": summaryTotals.attendanceTotal,
        Variance: summaryTotals.total - summaryTotals.attendanceTotal,
      });

      const ws3 = XLSX.utils.aoa_to_sheet([OFFICE_HEADERS as unknown as string[]]);
      XLSX.utils.sheet_add_json(ws3, officeRows, {
        origin: "A2",
        skipHeader: true,
        header: OFFICE_HEADERS as unknown as string[],
      });

      (ws3 as any)["!cols"] = [
        { wch: 32 },
        { wch: 8 },
        { wch: 8 },
        { wch: 10 },
        { wch: 8 },
        { wch: 8 },
        { wch: 10 },
        { wch: 14 },
        { wch: 14 },
        { wch: 18 },
        { wch: 14 },
        { wch: 14 },
        { wch: 18 },
        { wch: 10 },
      ];
      (ws3 as any)["!autofilter"] = { ref: "A1:N1" };
      (ws3 as any)["!freeze"] = { ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };

      const hdr3 = Array.from({ length: OFFICE_HEADERS.length }, (_, i) => XLSX.utils.encode_cell({ r: 0, c: i }));
      for (const addr of hdr3) {
        const cell: any = (ws3 as any)[addr];
        cell.s = {
          font: { bold: true, color: { rgb: "1F2937" } },
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          fill: { patternType: "solid", fgColor: { rgb: "F3F4F6" } },
          border: {
            top: { style: "thin", color: { rgb: "D1D5DB" } },
            bottom: { style: "thin", color: { rgb: "D1D5DB" } },
            left: { style: "thin", color: { rgb: "D1D5DB" } },
            right: { style: "thin", color: { rgb: "D1D5DB" } },
          },
        };
      }
      (ws3 as any)["!rows"] = [{ hpt: 24 }];

      const ref3 = ws3["!ref"] as string;
      if (ref3) {
        const rg3 = XLSX.utils.decode_range(ref3);
        for (let R = 1; R <= rg3.e.r; R++) {
          const zebra = R % 2 === 1;
          for (let C = 0; C <= rg3.e.c; C++) {
            const addr = XLSX.utils.encode_cell({ r: R, c: C });
            const cell: any = (ws3 as any)[addr];
            if (!cell) continue;
            cell.s = {
              alignment: { vertical: "center" },
              border: {
                top: { style: "hair", color: { rgb: "E5E7EB" } },
                bottom: { style: "hair", color: { rgb: "E5E7EB" } },
                left: { style: "hair", color: { rgb: "E5E7EB" } },
                right: { style: "hair", color: { rgb: "E5E7EB" } },
              },
              ...(zebra ? { fill: { patternType: "solid", fgColor: { rgb: "FAFAFA" } } } : {}),
            };
            if (C >= 1) {
              cell.s.alignment = { ...(cell.s.alignment || {}), horizontal: "right" };
            }
          }
        }
      }

      XLSX.utils.book_append_sheet(wb, ws3, "Office Summary");
    }

    if (pendingAbsentees.length) {
      const ABSENT_HEADERS = ["Employee No", "Name", "Office", "Employee Type"] as const;
      const absentRows = pendingAbsentees.map((emp) => ({
        "Employee No": toDisplayEmployeeNo(emp.employeeNo),
        Name: emp.name,
        Office: normalizeOfficeName(emp.office),
        "Employee Type": emp.employeeTypeName || "-",
      }));

      const ws4 = XLSX.utils.aoa_to_sheet([ABSENT_HEADERS as unknown as string[]]);
      XLSX.utils.sheet_add_json(ws4, absentRows, {
        origin: "A2",
        skipHeader: true,
        header: ABSENT_HEADERS as unknown as string[],
      });

      (ws4 as any)["!cols"] = [
        { wch: 14 },
        { wch: 32 },
        { wch: 36 },
        { wch: 22 },
      ];
      (ws4 as any)["!autofilter"] = { ref: "A1:D1" };
      (ws4 as any)["!freeze"] = {
        ySplit: 1,
        topLeftCell: "A2",
        activePane: "bottomLeft",
        state: "frozen",
      };

      const headerCells = ABSENT_HEADERS.map((_, i) =>
        XLSX.utils.encode_cell({ r: 0, c: i })
      );
      for (const addr of headerCells) {
        const cell: any = (ws4 as any)[addr];
        cell.s = {
          font: { bold: true, color: { rgb: "1F2937" } },
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          fill: { patternType: "solid", fgColor: { rgb: "F3F4F6" } },
          border: {
            top: { style: "thin", color: { rgb: "D1D5DB" } },
            bottom: { style: "thin", color: { rgb: "D1D5DB" } },
            left: { style: "thin", color: { rgb: "D1D5DB" } },
            right: { style: "thin", color: { rgb: "D1D5DB" } },
          },
        };
      }
      (ws4 as any)["!rows"] = [{ hpt: 24 }];

      const range = ws4["!ref"] as string | undefined;
      if (range) {
        const decoded = XLSX.utils.decode_range(range);
        for (let R = 1; R <= decoded.e.r; R++) {
          const zebra = R % 2 === 1;
          for (let C = 0; C <= decoded.e.c; C++) {
            const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
            const cell: any = (ws4 as any)[cellAddr];
            if (!cell) continue;
            cell.s = {
              alignment: { vertical: "center" },
              border: {
                top: { style: "hair", color: { rgb: "E5E7EB" } },
                bottom: { style: "hair", color: { rgb: "E5E7EB" } },
                left: { style: "hair", color: { rgb: "E5E7EB" } },
                right: { style: "hair", color: { rgb: "E5E7EB" } },
              },
              ...(zebra ? { fill: { patternType: "solid", fgColor: { rgb: "FAFAFA" } } } : {}),
            };
            if (C === 0 || C === 3) {
              cell.s.alignment = { ...(cell.s.alignment || {}), horizontal: "center" };
            }
          }
        }
      }

      XLSX.utils.book_append_sheet(wb, ws4, "Absentees");
    }

      XLSX.writeFile(wb, `Attendance_${new Date().toISOString().slice(0, 10)}.xlsx`, { compression: true });

      toast.success("Excel saved", { id: t });
    } catch (e) {
      console.error(e);
      toast.error("Export failed", { id: t });
    } finally {
      setIsExporting(false);
    }
  }

  function removeFile(name: string) {
    const next = filesInfo.filter(f => f.name !== name);
    setFilesInfo(next);
    recomputeFromFiles(next);
    if (!next.length && fileRef.current) fileRef.current.value = "";
  }


  function recomputeFromFiles(next: ParsedFile[]) {
    const mergedRows = next.flatMap(p => p.rows.map(r => ({ ...r, __source: p.name })));
    setRows(mergedRows);

    const unionHeaders = Array.from(new Set(next.flatMap(p => p.headers)));
    setHeaders(unionHeaders);

    setMappingByFile(prev => {
      const copy = { ...prev };
      for (const f of next) if (!copy[f.name]) copy[f.name] = guessMappingFromHeaders(f.headers);
      return copy;
    });

    setMapping(guessMappingFromHeaders(unionHeaders)); // ALL scope guess once
    setFileName(next.map(f => f.name).join(", "));
    setPreview([]);
    setOfficeSummary([]);
    setAbsentEmployees([]);
    setManuallyCheckedAbsentees({});
    setActiveTab("preview");
  }


  function headersForScope(): string[] {
    if (mapTarget === MAP_ALL) return headers;
    const f = filesInfo.find(x => x.name === mapTarget);
    return f?.headers ?? headers;
  }

  function adjustOfficeSummaryForManual(emp: AbsentEmployee, delta: 1 | -1) {
    if (!delta) return;
    const officeName = normalizeOfficeName(emp.office);
    const category = mapEmployeeTypeToCategory(emp.employeeTypeName);

    setOfficeSummary((prev) => {
      let found = false;
      const updated = prev.map((row) => {
        if (normalizeOfficeName(row.office) !== officeName) return row;
        found = true;
        const current = row.attendance[category];
        const maxForCategory = row.counts[category];
        const nextValue = Math.max(0, Math.min(maxForCategory, current + delta));
        const appliedDelta = nextValue - current;
        if (appliedDelta === 0) return row;
        const nextTotal = Math.max(
          0,
          Math.min(row.total, row.attendanceTotal + appliedDelta)
        );
        return {
          ...row,
          attendance: {
            ...row.attendance,
            [category]: nextValue,
          },
          attendanceTotal: nextTotal,
        };
      });

      if (!found && delta > 0) {
        const counts = createEmptyCounts();
        const attendance = createEmptyCounts();
        counts[category] = delta;
        attendance[category] = delta;
        updated.push({
          office: officeName,
          counts,
          total: delta,
          attendance,
          attendanceTotal: delta,
        });
      }

      return updated;
    });
  }

  function toggleManualAttendance(emp: AbsentEmployee) {
    const key = getAbsentKey(emp);
    const currentlyMarked = !!manuallyCheckedAbsentees[key];

    setManuallyCheckedAbsentees((prev) => {
      const next = { ...prev };
      if (currentlyMarked) {
        delete next[key];
      } else {
        next[key] = true;
      }
      return next;
    });

    adjustOfficeSummaryForManual(emp, currentlyMarked ? -1 : 1);
  }

  function updateMapField(field: keyof Mapping, v?: string) {
    if (mapTarget === MAP_ALL) {
      setMapping(m => ({ ...m, [field]: v }));
    } else {
      setMappingByFile(prev => ({
        ...prev,
        [mapTarget]: { ...(prev[mapTarget] || {}), [field]: v }
      }));
    }
  }

  function copyMapping(from: string, to: string) {
    setMappingByFile(prev => {
      const src = prev[from] || {};
      return { ...prev, [to]: { ...src } };
    });
    toast.success(`Copied mapping: ${from} -> ${to}`);
  }
type Acc = { name: string; office: string; empNo: string; minutes: number[] };

function toMinutes(hhmmss?: string): number {
  const t = (hhmmss || "").trim();
  if (!t) return NaN;
  const [h="0", m="0", s="0"] = t.split(":");
  const hh = Number(h), mm = Number(m), ss = Number(s);
  if (Number.isNaN(hh) || Number.isNaN(mm) || Number.isNaN(ss)) return NaN;
  return hh * 60 + mm + Math.floor(ss / 60);
}
function minutesToHHMM(m: number): string {
  if (!Number.isFinite(m)) return "";
  const h = Math.floor(m/60).toString().padStart(2,"0");
  const mm = Math.floor(m%60).toString().padStart(2,"0");
  return `${h}:${mm}`;
}

function buildDailySummary(rows: any[]) {           // <-- accept rows here
  const START = 8*60, END = 17*60, LUNCH = 60;

  const byKey = new Map<string, Acc>();

  for (const r of rows) {                           // <-- use rows, not preview
    if (!r.idMatched) continue;
    const idPart = r.employeeId || (r.employeeNo ? String(r.employeeNo) : r.id) || "";
    const key = `${idPart}|${r.date}`;

    let acc = byKey.get(key);
    if (!acc) {
      acc = {
        name: r.name,
        office: r.office,
        empNo: (r.employeeNo ? String(r.employeeNo) : "")
                .split(",")[0].replace(/\D/g, ""),
        minutes: [] as number[],
      };
      byKey.set(key, acc);
    }
    const m = toMinutes(r.time);
    if (Number.isFinite(m)) acc.minutes.push(m);
  }

  const out: Record<string, any>[] = [];
  byKey.forEach((v, key) => {
    v.minutes.sort((a: number, b: number) => a - b);
    const first = v.minutes[0];
    const last  = v.minutes[v.minutes.length - 1];
    const present = Number.isFinite(first) && Number.isFinite(last);

    const total = present ? Math.max(0, (last - first) - LUNCH) : 0;
    const tardy = present ? Math.max(0, first - START) : 0;
    const under = present ? Math.max(0, END - last) : 0;

    const [, date] = key.split("|");
    out.push({
      Date: date,
      Name: v.name,
      Office: v.office,
      "Employee No": v.empNo,
      "First In": minutesToHHMM(first),
      "Last Out": minutesToHHMM(last),
      "Total (mins)": total,
      "Tardy (mins)": tardy,
      "Undertime (mins)": under,
    });
  });

  return out;
}


  return (
    <div className="space-y-4">
      {filesInfo.length > 1 && (
        <div className="flex items-center gap-2 text-sm justify-between">
          <span className="text-sm font-medium">Copy mapping</span>
          <Select onValueChange={(from: any) => copyMapping(from, mapTarget)} disabled={mapTarget === MAP_ALL}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="From file..." />
            </SelectTrigger>
            <SelectContent>
              {filesInfo
                .filter(f => f.name !== mapTarget)
                .map(f => <SelectItem key={f.name} value={f.name}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <span>to</span>
          <code className="px-2 py-1 bg-muted rounded">{mapTarget === MAP_ALL ? "ALL" : mapTarget}</code>
          <div className="flex items-center gap-2">
        <div className="text-sm font-medium">Mapping scope</div>
        <Select value={mapTarget} onValueChange={setMapTarget}>
          <SelectTrigger className="w-[320px]">
            <SelectValue placeholder="Choose file to map" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={MAP_ALL}>Apply to ALL files</SelectItem>
            {filesInfo.map(f => (
              <SelectItem key={f.name} value={f.name}>{f.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
        </div>
      )}


      

      <Card>
        <CardHeader>
          <CardTitle>CSV Attendance Import</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <input
              ref={fileRef}
              id="csvFiles"
              type="file"
              accept=".csv,text/csv"
              multiple
              onChange={onFiles}
              className="sr-only"
            />

            <div
              className={cn(
                "flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 text-center transition",
                isDragging ? "border-primary bg-primary/10" : "border-muted-foreground/30 bg-muted/10",
                (isParsing || isPreviewing) ? "pointer-events-none opacity-60" : "cursor-pointer"
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => {
                if (isParsing || isPreviewing) return;
                fileRef.current?.click();
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if ((event.key === "Enter" || event.key === " ") && !isParsing && !isPreviewing) {
                  event.preventDefault();
                  fileRef.current?.click();
                }
              }}
            >
              <UploadCloud className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <p className="mt-2 text-sm font-medium">Drag & drop attendance CSV files here</p>
              <p className="text-xs text-muted-foreground">or click to choose files</p>
              {filesInfo.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {`${filesInfo.length} file${filesInfo.length > 1 ? "s" : ""} selected`}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={isParsing || isPreviewing}
              >
                Choose Files
              </Button>

              <span className="text-sm">
                {filesInfo.length
                  ? `${filesInfo.length} file${filesInfo.length > 1 ? "s" : ""} selected`
                  : "No file selected"}
              </span>

              {filesInfo.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={clearFile}
                  aria-label="Clear all files"
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={dedup}
                    onChange={(e) => setDedup(e.target.checked)}
                  />
                  Deduplicate by ID + Date + Time
                </label>
              </div>
            </div>

            <Select value={idType} onValueChange={(v: any) => setIdType(v)} disabled={isParsing || isPreviewing}>
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
                <Select
                  value={(mapTarget === MAP_ALL ? mapping.scanText : mappingByFile[mapTarget]?.scanText) as any}
                  onValueChange={(v) => updateMapField("scanText", v)}
                >
                  <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                  <SelectContent>
                    {headersForScope().map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>

                <div className="text-xs text-muted-foreground">Optional if you already have a pure ID column.</div>
                <div className="text-sm font-medium mt-3">OR Direct ID Column</div>
                <Select
                  value={(mapTarget === MAP_ALL ? mapping.idColumn : mappingByFile[mapTarget]?.idColumn) as any}
                  onValueChange={(v) => updateMapField("idColumn", v)}
                >
                  <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                  <SelectContent>
                    {headersForScope().map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
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
                <Select
                  value={(mapTarget === MAP_ALL ? mapping.timestamp : mappingByFile[mapTarget]?.timestamp) as any}
                  onValueChange={(v) => updateMapField("timestamp", v)}
                >
                  <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                  <SelectContent>
                    {headersForScope().map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>

                <div className="text-xs text-muted-foreground">If your CSV has a single date-time field.</div>

                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <div className="text-sm font-medium">Date Column</div>
                    <Select
                      value={(mapTarget === MAP_ALL ? mapping.date : mappingByFile[mapTarget]?.date) as any}
                      onValueChange={(v) => updateMapField("date", v)}
                    >
                      <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                      <SelectContent>
                        {headersForScope().map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
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
            <Button onClick={resolvePreview} disabled={!headers.length || isPreviewing || isParsing}>
              {isPreviewing ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Previewing...</>) : "Preview"}
            </Button>
            <Button variant="outline" onClick={exportExcel} disabled={!preview.length || isExporting}>
              {isExporting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Exporting...</>) : "Export to Excel"}
            </Button>
          </div>

          {!!preview.length && (
            <Tabs
              value={activeTab}
              onValueChange={(value) =>
                setActiveTab(value as "preview" | "summary" | "absentees")
              }
              className="mt-4"
            >
              <TabsList>
                <TabsTrigger value="preview">Preview{preview.length ? ` (${preview.length.toLocaleString()})` : ""}</TabsTrigger>
                <TabsTrigger value="summary" disabled={!officeSummary.length}>
                  Office Summary{officeSummary.length ? ` (${officeSummary.length})` : ""}
                </TabsTrigger>
                <TabsTrigger value="absentees" disabled={!absentEmployees.length}>
                  Manual Check{pendingAbsentees.length ? ` (${pendingAbsentees.length})` : ""}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="preview" className="mt-3">
                <div className="border rounded-md overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        {['Date', 'Time', 'Employee No', 'Name', 'Office', 'Matched'].map((h) => (
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
                          <td className="px-3 py-1">{r.idMatched ? 'Yes' : 'No'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-3 py-2 text-xs text-muted-foreground">Showing first 50 rows.</div>
                </div>
              </TabsContent>
              <TabsContent value="summary" className="mt-3">
                {officeSummary.length ? (
                  <div className="border rounded-md overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Office</th>
                          {CATEGORY_ORDER.map((cat) => (
                            <th key={`head-all-${cat}`} className="px-3 py-2 text-right font-medium">
                              {CATEGORY_LABEL[cat]}
                            </th>
                          ))}
                          <th className="px-3 py-2 text-right font-medium">Total</th>
                          {CATEGORY_ORDER.map((cat) => (
                            <th key={`head-att-${cat}`} className="px-3 py-2 text-right font-medium">
                              {`Attended ${CATEGORY_LABEL[cat]}`}
                            </th>
                          ))}
                          <th className="px-3 py-2 text-right font-medium">Attendance Total</th>
                          <th className="px-3 py-2 text-right font-medium">Variance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {officeSummary.map((row) => (
                          <tr key={row.office} className="border-t">
                            <td className="px-3 py-1 font-medium">{row.office}</td>
                            {CATEGORY_ORDER.map((cat) => (
                              <td
                                key={`${row.office}-${cat}-total`}
                                className="px-3 py-1 text-right"
                              >
                                {row.counts[cat].toLocaleString()}
                              </td>
                            ))}
                            <td className="px-3 py-1 text-right font-medium">
                              {row.total.toLocaleString()}
                            </td>
                            {CATEGORY_ORDER.map((cat) => (
                              <td
                                key={`${row.office}-${cat}-att`}
                                className="px-3 py-1 text-right text-emerald-600"
                              >
                                {row.attendance[cat].toLocaleString()}
                              </td>
                            ))}
                            <td className="px-3 py-1 text-right text-emerald-600 font-medium">
                              {row.attendanceTotal.toLocaleString()}
                            </td>
                            <td className="px-3 py-1 text-right">
                              {(row.total - row.attendanceTotal).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t font-semibold bg-muted/60">
                          <td className="px-3 py-2">Grand total</td>
                          {CATEGORY_ORDER.map((cat) => (
                            <td key={`grand-${cat}`} className="px-3 py-2 text-right">
                              {summaryTotals.counts[cat].toLocaleString()}
                            </td>
                          ))}
                          <td className="px-3 py-2 text-right">
                            {summaryTotals.total.toLocaleString()}
                          </td>
                          {CATEGORY_ORDER.map((cat) => (
                            <td key={`grand-att-${cat}`} className="px-3 py-2 text-right text-emerald-700">
                              {summaryTotals.attendance[cat].toLocaleString()}
                            </td>
                          ))}
                          <td className="px-3 py-2 text-right text-emerald-700">
                            {summaryTotals.attendanceTotal.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {(summaryTotals.total - summaryTotals.attendanceTotal).toLocaleString()}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="border rounded-md px-3 py-4 text-sm text-muted-foreground bg-muted/50">
                    No office summary available.
                  </div>
                )}
              </TabsContent>
              <TabsContent value="absentees" className="mt-3 space-y-4">
                {!absentEmployees.length ? (
                  <div className="border rounded-md px-3 py-4 text-sm text-muted-foreground bg-muted/50">
                    Everyone in the roster already has a recorded scan for the selected files.
                  </div>
                ) : (
                  <>
                    {manuallyMarkedAbsentees.length > 0 && (
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                        {manuallyMarkedAbsentees.length} employee
                        {manuallyMarkedAbsentees.length > 1 ? "s" : ""} manually marked as present.
                        Office totals above reflect these adjustments.
                      </div>
                    )}

                    {pendingAbsentees.length ? (
                      <div className="border rounded-md overflow-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-muted">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium">Employee No</th>
                              <th className="px-3 py-2 text-left font-medium">Name</th>
                              <th className="px-3 py-2 text-left font-medium">Office</th>
                              <th className="px-3 py-2 text-left font-medium">Employee Type</th>
                              <th className="px-3 py-2 text-right font-medium">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pendingAbsentees.map((emp) => (
                              <tr key={getAbsentKey(emp)} className="border-t">
                                <td className="px-3 py-1">{toDisplayEmployeeNo(emp.employeeNo)}</td>
                                <td className="px-3 py-1">{emp.name}</td>
                                <td className="px-3 py-1">{normalizeOfficeName(emp.office)}</td>
                                <td className="px-3 py-1">{emp.employeeTypeName || "-"}</td>
                                <td className="px-3 py-1 text-right">
                                  <Button
                                    size="sm"
                                    onClick={() => toggleManualAttendance(emp)}
                                    className="inline-flex items-center gap-1"
                                  >
                                    <Check className="h-4 w-4" />
                                    Mark Present
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="border rounded-md px-3 py-4 text-sm text-muted-foreground bg-muted/50">
                        All flagged employees have been manually marked as present.
                      </div>
                    )}

                    {manuallyMarkedAbsentees.length > 0 && (
                      <div className="border rounded-md overflow-auto">
                        <div className="border-b px-3 py-2 text-sm font-medium">
                          Manually marked as present
                        </div>
                        <table className="min-w-full text-sm">
                          <thead className="bg-muted">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium">Employee No</th>
                              <th className="px-3 py-2 text-left font-medium">Name</th>
                              <th className="px-3 py-2 text-left font-medium">Office</th>
                              <th className="px-3 py-2 text-left font-medium">Employee Type</th>
                              <th className="px-3 py-2 text-right font-medium">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {manuallyMarkedAbsentees.map((emp) => (
                              <tr key={`marked-${getAbsentKey(emp)}`} className="border-t">
                                <td className="px-3 py-1">{toDisplayEmployeeNo(emp.employeeNo)}</td>
                                <td className="px-3 py-1">{emp.name}</td>
                                <td className="px-3 py-1">{normalizeOfficeName(emp.office)}</td>
                                <td className="px-3 py-1">{emp.employeeTypeName || "-"}</td>
                                <td className="px-3 py-1 text-right">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => toggleManualAttendance(emp)}
                                    className="inline-flex items-center gap-1"
                                  >
                                    <Undo2 className="h-4 w-4" />
                                    Undo
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>
            </Tabs>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
