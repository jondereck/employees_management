  "use client";

  import { useRef, useState } from "react";
  import Papa from "papaparse";
  import { Button } from "@/components/ui/button";
  import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
  import { Input } from "@/components/ui/input";
  import * as XLSX from "xlsx-js-style";
  import { toast } from "sonner";
  import { Loader2, X } from "lucide-react";

  import { parseIdFromText } from "@/lib/parseEmployeeIdFromText";


  type MappingByFile = Record<string, Mapping>;
  const MAP_ALL = "_ALL_";

 

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



    function toDisplayEmployeeNo(val?: string) {
      // take text before comma, then keep digits only
      const left = (val ?? "").split(",")[0].trim();
      const digitsOnly = (left.match(/\d+/g)?.join("") ?? "");
      return digitsOnly;
    }

    async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
      const list = Array.from(e.target.files || []);
      if (!list.length) return;

      const t = toast.loading("Parsing CSV files…");
      setIsParsing(true);
      try {
        const parsed = await Promise.all(list.map(parseCsv));

        // merge with existing by filename (replace same name)
        const byName = new Map<string, ParsedFile>();
        for (const f of filesInfo) byName.set(f.name, f);
        for (const p of parsed) byName.set(p.name, p);

        const next = Array.from(byName.values());
        setFilesInfo(next);
        recomputeFromFiles(next);

        toast.success(`Added ${parsed.reduce((s, p) => s + p.count, 0).toLocaleString()} rows from ${parsed.length} file(s)`, { id: t });
      } catch (err) {
        console.error(err);
        toast.error("Failed to parse one or more files", { id: t });
      } finally {
        setIsParsing(false);
        if (fileRef.current) fileRef.current.value = ""; // allow re-pick same files
      }
    }


    function clearFile() {
      if (fileRef.current) fileRef.current.value = "";
      setFileName("");
      setHeaders([]);
      setRows([]);
      setMapping({});
      setPreview([]);
      setFilesInfo([]);
      toast.message("File cleared");
    }
  function safeRegex(s?: string): RegExp | undefined {
    if (!s?.trim()) return undefined;
    try { return new RegExp(s, "i"); } catch { return undefined; }
  }

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
      
        const filesMissingId = filesInfo.filter(f => {
          const m = mappingByFile[f.name] || mapping;
          return !m.idColumn && !m.scanText;
        });
        if (filesMissingId.length) {
          toast.warning(`No ID mapping for: ${filesMissingId.map(f => f.name).join(", ")}`);
        }
      const payloadRows = buildPayload();
      const t = toast.loading("Resolving employees…");
      setIsPreviewing(true);
      try {
        const res = await fetch("/api/import/attendance/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idType, rows: payloadRows, regex: regex || undefined }),
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

          const matched = rowsOut.filter((r: any) => r.idMatched).length;
          const removed = (json.rows.length - rowsOut.length);
          toast.success(
            `Preview ready — ${matched}/${rowsOut.length} matched${dedup && removed > 0 ? `, removed ${removed} duplicate(s)` : ""}`,
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
      const t = toast.loading("Exporting Excel…");

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
  }


    function headersForScope(): string[] {
      if (mapTarget === MAP_ALL) return headers;
      const f = filesInfo.find(x => x.name === mapTarget);
      return f?.headers ?? headers;
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


    return (
      <div className="space-y-4">
        {filesInfo.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {filesInfo.map(f => (
              <span key={f.name} className="inline-flex items-center gap-2 px-2 py-1 rounded bg-muted text-xs">
                {f.name} <span className="text-muted-foreground">({f.count})</span>
                <button
                  type="button"
                  onClick={() => removeFile(f.name)}
                  className="ml-1 rounded hover:bg-background p-0.5"
                  aria-label={`Remove ${f.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

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

              {/* Faux picker */}
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
                    value={(mapTarget === MAP_ALL ? mapping.timestamp  : mappingByFile[mapTarget]?.timestamp ) as any}
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
                {isPreviewing ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Previewing…</>) : "Preview"}
              </Button>
              <Button variant="outline" onClick={exportExcel} disabled={!preview.length || isExporting}>
                {isExporting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Exporting…</>) : "Export to Excel"}
              </Button>
            </div>

            {!!preview.length && (
              <div className="mt-4 border rounded-md overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      {["Date", "Time", "Employee No", "Name", "Office", "Matched"].map(h => (
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