"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, UploadCloud, Filter, CalendarDays, Users } from "lucide-react";
import { aggregateEmployee } from "@/lib/attendance/compute";
import {
  EmployeeLite,
  EmployeeMatch,
  OfficeLite,
  RawRecord,
  Schedule,
  UnmatchedBio,
  UploadMeta,
} from "@/lib/attendance/types";

const defaultSchedule: Schedule = { start: "08:00", end: "17:00", graceMin: 0 };

const formatDate = (date: string | undefined) => {
  if (!date) return "";
  try {
    const [year, month, day] = date.split("-").map(Number);
    const d = new Date(year, (month ?? 1) - 1, day ?? 1);
    return d.toLocaleDateString();
  } catch {
    return date;
  }
};

const buildRange = (raw: RawRecord[]) => {
  const dates = raw.flatMap((record) => record.punches.map((punch) => punch.date));
  if (!dates.length) return undefined;
  const sorted = [...new Set(dates)].sort();
  return { start: sorted[0], end: sorted[sorted.length - 1] };
};

const formatNumber = (value: number) => value.toLocaleString();

const composeSchedule = (schedule: Schedule) => `${schedule.start} – ${schedule.end} (grace ${schedule.graceMin}m)`;

const paginate = <T,>(rows: T[], page: number, perPage: number) => {
  const start = (page - 1) * perPage;
  const end = start + perPage;
  return rows.slice(start, end);
};

type UploadBundle = {
  uploadId: string;
  month: string;
  raw: RawRecord[];
  meta: UploadMeta;
  matched: EmployeeMatch[];
  unmatched: UnmatchedBio[];
  employees: EmployeeLite[];
  offices: OfficeLite[];
};

type AttendanceClientProps = {
  departmentId: string;
  initialOffices: OfficeLite[];
  initialEmployees: EmployeeLite[];
};

export function AttendanceClient({
  departmentId,
  initialOffices,
  initialEmployees,
}: AttendanceClientProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("upload");
  const [dragActive, setDragActive] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [month, setMonth] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadBundle, setUploadBundle] = useState<UploadBundle | null>(null);
  const [pendingSchedule, setPendingSchedule] = useState<Schedule>(defaultSchedule);
  const [effectiveSchedule, setEffectiveSchedule] = useState<Schedule>(defaultSchedule);
  const [selectedOffices, setSelectedOffices] = useState<string[]>([]);
  const [summaryPage, setSummaryPage] = useState(1);
  const [detailPage, setDetailPage] = useState(1);
  const [pendingMappings, setPendingMappings] = useState<Record<string, string>>({});
  const [savingMappings, setSavingMappings] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  const offices = uploadBundle?.offices ?? initialOffices;
  const employees = uploadBundle?.employees ?? initialEmployees;

  const employeeMap = useMemo(() => {
    return new Map(employees.map((employee) => [employee.id, employee]));
  }, [employees]);

  const officeMap = useMemo(() => {
    return new Map(offices.map((office) => [office.id, office.name]));
  }, [offices]);

  const computation = useMemo(() => {
    if (!uploadBundle) return { summary: [], detail: [] };

    const matches = selectedOffices.length
      ? uploadBundle.matched.filter((match) => selectedOffices.includes(match.officeId))
      : uploadBundle.matched;

    const summary = matches.map((match) => {
      const employee = employeeMap.get(match.employeeId);
      const officeName = officeMap.get(match.officeId) ?? "Unassigned";
      const aggregated = aggregateEmployee(match, effectiveSchedule);
      return {
        employeeId: match.employeeId,
        employee: employee?.name ?? "Unknown",
        officeId: match.officeId,
        office: officeName,
        present: aggregated.summary.present,
        tardyCount: aggregated.summary.tardyCount,
        tardyMin: aggregated.summary.tardyMin,
        underCount: aggregated.summary.underCount,
        underMin: aggregated.summary.underMin,
        exceptions: aggregated.summary.exceptions,
      };
    });

    summary.sort((a, b) => a.employee.localeCompare(b.employee));

    const detail = matches.flatMap((match) => {
      const employee = employeeMap.get(match.employeeId);
      const officeName = officeMap.get(match.officeId) ?? "Unassigned";
      const aggregated = aggregateEmployee(match, effectiveSchedule);
      return aggregated.detail.map((day) => ({
        employeeId: match.employeeId,
        employee: employee?.name ?? "Unknown",
        officeId: match.officeId,
        office: officeName,
        date: day.date,
        firstIn: day.firstIn,
        lastOut: day.lastOut,
        tardyMin: day.tardyMin,
        underMin: day.underMin,
        exception: day.exception,
      }));
    });

    detail.sort((a, b) => a.date.localeCompare(b.date) || a.employee.localeCompare(b.employee));

    return { summary, detail };
  }, [uploadBundle, selectedOffices, employeeMap, officeMap, effectiveSchedule]);

  const range = useMemo(() => (uploadBundle ? buildRange(uploadBundle.raw) : undefined), [uploadBundle]);

  const handleFileChange = (file: File | null) => {
    setPendingFile(file);
    if (file && !month) {
      const match = file.name.match(/(20\d{2})[-_](\d{2})/);
      if (match) {
        setMonth(`${match[1]}-${match[2]}`);
      }
    }
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleFileChange(file);
    }
  };

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = () => setDragActive(false);

  const handleUpload = async () => {
    if (!pendingFile) {
      setError("Please select a .xls or .xlsx file to upload");
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", pendingFile);
    if (month) {
      formData.append("month", month);
    }

    try {
      const response = await fetch(`/api/hrps/attendance/uploads?departmentId=${departmentId}`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to parse upload");
      }

      const payload = (await response.json()) as UploadBundle;
      if (!payload.month && !month) {
        setError("Unable to detect the month from the file. Please set the month above and re-upload.");
        setActiveTab("upload");
        return;
      }

      const resolvedMonth = payload.month || month;
      setUploadBundle({ ...payload, month: resolvedMonth });
      setMonth(resolvedMonth);
      setPendingSchedule(defaultSchedule);
      setEffectiveSchedule(defaultSchedule);
      setSelectedOffices([]);
      setActiveTab("review");
      setSummaryPage(1);
      setDetailPage(1);
      setPendingMappings({});
      toast({
        title: "Upload complete",
        description: `Parsed ${payload.meta.rows} rows for ${payload.month || month}`,
      });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleRecompute = () => {
    setEffectiveSchedule({ ...pendingSchedule });
    toast({
      title: "Recomputed",
      description: `Schedule applied: ${composeSchedule(pendingSchedule)}`,
    });
  };

  const toggleOffice = (officeId: string) => {
    setSelectedOffices((prev) =>
      prev.includes(officeId) ? prev.filter((id) => id !== officeId) : [...prev, officeId]
    );
    setSummaryPage(1);
    setDetailPage(1);
  };

  const handleMappingChange = (bioId: string, employeeId: string) => {
    setPendingMappings((prev) => ({ ...prev, [bioId]: employeeId }));
  };

  const handleSaveMappings = async () => {
    if (!uploadBundle) return;
    const mappings = Object.entries(pendingMappings)
      .filter(([, employeeId]) => employeeId)
      .map(([bioUserId, employeeId]) => ({ bioUserId, employeeId }));

    if (!mappings.length) {
      toast({ title: "No mappings", description: "Select employees to map before saving." });
      return;
    }

    setSavingMappings(true);
    try {
      const response = await fetch(`/api/hrps/attendance/uploads/${uploadBundle.uploadId}/mappings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to save mappings");
      }

      const payload = await response.json();
      setUploadBundle((prev) =>
        prev
          ? {
              ...prev,
              matched: payload.matched,
              unmatched: payload.unmatched,
            }
          : prev
      );
      setPendingMappings({});
      toast({ title: "Mappings saved", description: `Updated ${payload.updated} Bio IDs.` });
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Unable to save mappings",
        variant: "destructive",
      });
    } finally {
      setSavingMappings(false);
    }
  };

  const handleExport = async (format: "xlsx" | "csv", granularity: "summary" | "detail") => {
    if (!uploadBundle) return;
    setExporting(`${format}-${granularity}`);
    try {
      const response = await fetch(`/api/hrps/attendance/uploads/${uploadBundle.uploadId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          granularity,
          officeIds: selectedOffices.length ? selectedOffices : undefined,
          schedule: effectiveSchedule,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error ?? "Export failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const disposition = response.headers.get("content-disposition");
      const match = disposition?.match(/filename="?([^";]+)"?/i);
      const filename = match?.[1] ?? `attendance-export.${format}`;
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Export generated", description: filename });
    } catch (err) {
      console.error(err);
      toast({
        title: "Export failed",
        description: err instanceof Error ? err.message : "Unable to generate export",
        variant: "destructive",
      });
    } finally {
      setExporting(null);
    }
  };

  const summaryPerPage = 10;
  const detailPerPage = 15;
  const totalSummaryPages = Math.max(1, Math.ceil(computation.summary.length / summaryPerPage));
  const totalDetailPages = Math.max(1, Math.ceil(computation.detail.length / detailPerPage));

  const summarySlice = paginate(computation.summary, summaryPage, summaryPerPage);
  const detailSlice = paginate(computation.detail, detailPage, detailPerPage);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b pb-4">
        <h1 className="text-2xl font-semibold">HRPS ▸ Tardiness & Undertime</h1>
        <p className="text-sm text-muted-foreground">
          Upload biometric attendance, map Bio IDs to employees, review tardiness and undertime, then export per-office reports.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="review" disabled={!uploadBundle}>Review &amp; Map</TabsTrigger>
          <TabsTrigger value="download" disabled={!uploadBundle}>Download</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Upload error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Upload biometric attendance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                className={`flex flex-col items-center justify-center rounded-md border-2 border-dashed p-8 text-center transition ${
                  dragActive ? "border-green-500 bg-green-50" : "border-muted"
                }`}
              >
                <UploadCloud className="h-10 w-10 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Drag and drop .xls or .xlsx files here, or click to browse.
                </p>
                <input
                  type="file"
                  accept=".xls,.xlsx"
                  onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
                  className="hidden"
                  id="attendance-upload-input"
                />
                <Button variant="outline" size="sm" className="mt-4" onClick={() => document.getElementById("attendance-upload-input")?.click()}>
                  Choose file
                </Button>
                {pendingFile && <p className="mt-2 text-xs text-muted-foreground">Selected: {pendingFile.name}</p>}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="month">Month (YYYY-MM)</Label>
                  <Input
                    id="month"
                    type="month"
                    value={month}
                    onChange={(event) => setMonth(event.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleUpload} disabled={uploading} className="w-full">
                    {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Upload &amp; Parse
                  </Button>
                </div>
              </div>

              {uploadBundle && (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-md border p-4">
                    <div className="text-sm text-muted-foreground">Rows parsed</div>
                    <div className="text-xl font-semibold">{formatNumber(uploadBundle.meta.rows)}</div>
                  </div>
                  <div className="rounded-md border p-4">
                    <div className="text-sm text-muted-foreground">Distinct Bio IDs</div>
                    <div className="text-xl font-semibold">{formatNumber(uploadBundle.meta.distinctBio)}</div>
                  </div>
                  <div className="rounded-md border p-4">
                    <div className="text-sm text-muted-foreground">Date range</div>
                    <div className="text-xl font-semibold">
                      {range ? `${formatDate(range.start)} – ${formatDate(range.end)}` : "N/A"}
                    </div>
                    {uploadBundle.meta.inferred && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Month inferred from file name/logs.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="review" className="space-y-4">
          {uploadBundle ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Review tardiness &amp; undertime</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Filter className="mr-2 h-4 w-4" />
                          Offices
                          {selectedOffices.length ? (
                            <Badge variant="secondary" className="ml-2">
                              {selectedOffices.length}
                            </Badge>
                          ) : null}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-2">
                        <div className="space-y-2">
                          {offices.map((office) => (
                            <label key={office.id} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={selectedOffices.includes(office.id)}
                                onCheckedChange={() => toggleOffice(office.id)}
                              />
                              <span>{office.name}</span>
                            </label>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      Matched employees: {uploadBundle.matched.length}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarDays className="h-4 w-4" />
                      Schedule: {composeSchedule(effectiveSchedule)}
                    </div>
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button variant="outline" size="sm">
                          Unmatched Bio IDs ({uploadBundle.unmatched.length})
                        </Button>
                      </SheetTrigger>
                      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                        <SheetHeader>
                          <SheetTitle>Unmatched Bio IDs</SheetTitle>
                        </SheetHeader>
                        <div className="mt-4 space-y-4">
                          {uploadBundle.unmatched.length === 0 && (
                            <p className="text-sm text-muted-foreground">All Bio IDs are mapped.</p>
                          )}
                          {uploadBundle.unmatched.map((item) => (
                            <div key={item.bioUserId} className="rounded-md border p-3 space-y-2">
                              <div className="font-medium">Bio ID: {item.bioUserId}</div>
                              {item.name && <div className="text-sm text-muted-foreground">Name hint: {item.name}</div>}
                              {item.officeHint && (
                                <div className="text-sm text-muted-foreground">Office hint: {item.officeHint}</div>
                              )}
                              <div className="space-y-2">
                                <Label>Select employee</Label>
                                <Select
                                  value={pendingMappings[item.bioUserId] ?? ""}
                                  onValueChange={(value) => handleMappingChange(item.bioUserId, value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Choose employee" />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-72">
                                    {employees.map((employee) => (
                                      <SelectItem key={employee.id} value={employee.id}>
                                        {employee.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-6 flex justify-end">
                          <Button onClick={handleSaveMappings} disabled={savingMappings}>
                            {savingMappings && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save mappings
                          </Button>
                        </div>
                      </SheetContent>
                    </Sheet>
                  </div>

                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Start time</Label>
                      <Input
                        type="time"
                        value={pendingSchedule.start}
                        onChange={(event) => setPendingSchedule((prev) => ({ ...prev, start: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End time</Label>
                      <Input
                        type="time"
                        value={pendingSchedule.end}
                        onChange={(event) => setPendingSchedule((prev) => ({ ...prev, end: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Grace (minutes)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={pendingSchedule.graceMin}
                        onChange={(event) =>
                          setPendingSchedule((prev) => ({ ...prev, graceMin: Number(event.target.value) || 0 }))
                        }
                      />
                    </div>
                    <div className="flex items-end">
                      <Button className="w-full" onClick={handleRecompute}>
                        Recompute
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-md border p-4 bg-muted/50">
                    <div className="text-sm text-muted-foreground">
                      Showing {computation.summary.length} employees across {selectedOffices.length || offices.length} offices.
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Summary by employee</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Page {summaryPage} of {totalSummaryPages}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={summaryPage === 1} onClick={() => setSummaryPage((p) => Math.max(1, p - 1))}>
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={summaryPage === totalSummaryPages}
                        onClick={() => setSummaryPage((p) => Math.min(totalSummaryPages, p + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Office</TableHead>
                          <TableHead className="text-right">Days Present</TableHead>
                          <TableHead className="text-right">Tardy (count)</TableHead>
                          <TableHead className="text-right">Tardy (mins)</TableHead>
                          <TableHead className="text-right">Undertime (count)</TableHead>
                          <TableHead className="text-right">Undertime (mins)</TableHead>
                          <TableHead className="text-right">Exceptions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summarySlice.map((row) => (
                          <TableRow key={row.employeeId}>
                            <TableCell>{row.employee}</TableCell>
                            <TableCell>{row.office}</TableCell>
                            <TableCell className="text-right">{row.present}</TableCell>
                            <TableCell className="text-right">{row.tardyCount}</TableCell>
                            <TableCell className="text-right">{row.tardyMin}</TableCell>
                            <TableCell className="text-right">{row.underCount}</TableCell>
                            <TableCell className="text-right">{row.underMin}</TableCell>
                            <TableCell className="text-right">{row.exceptions}</TableCell>
                          </TableRow>
                        ))}
                        {summarySlice.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                              No matched employees for the selected filters.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Daily detail</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Page {detailPage} of {totalDetailPages}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={detailPage === 1} onClick={() => setDetailPage((p) => Math.max(1, p - 1))}>
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={detailPage === totalDetailPages}
                        onClick={() => setDetailPage((p) => Math.min(totalDetailPages, p + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Employee</TableHead>
                          <TableHead>Office</TableHead>
                          <TableHead className="text-right">First IN</TableHead>
                          <TableHead className="text-right">Last OUT</TableHead>
                          <TableHead className="text-right">Tardy (mins)</TableHead>
                          <TableHead className="text-right">Undertime (mins)</TableHead>
                          <TableHead>Exception</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailSlice.map((row, index) => (
                          <TableRow key={`${row.employeeId}-${row.date}-${index}`}>
                            <TableCell>{formatDate(row.date)}</TableCell>
                            <TableCell>{row.employee}</TableCell>
                            <TableCell>{row.office}</TableCell>
                            <TableCell className="text-right">{row.firstIn ?? "—"}</TableCell>
                            <TableCell className="text-right">{row.lastOut ?? "—"}</TableCell>
                            <TableCell className="text-right">{row.tardyMin}</TableCell>
                            <TableCell className="text-right">{row.underMin}</TableCell>
                            <TableCell>{row.exception ?? ""}</TableCell>
                          </TableRow>
                        ))}
                        {detailSlice.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                              No daily records available for the selected filters.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Alert>
              <AlertTitle>No upload yet</AlertTitle>
              <AlertDescription>Upload biometric attendance first to review tardiness and undertime.</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="download" className="space-y-4">
          {uploadBundle ? (
            <Card>
              <CardHeader>
                <CardTitle>Export reports</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Exports use the current schedule ({composeSchedule(effectiveSchedule)}) and office filters.
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <Button
                    variant="outline"
                    onClick={() => handleExport("xlsx", "summary")}
                    disabled={exporting === "xlsx-summary"}
                  >
                    {exporting === "xlsx-summary" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Export Summary (XLSX)
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleExport("xlsx", "detail")}
                    disabled={exporting === "xlsx-detail"}
                  >
                    {exporting === "xlsx-detail" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Export Detail (XLSX)
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleExport("csv", "summary")}
                    disabled={exporting === "csv-summary"}
                  >
                    {exporting === "csv-summary" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Export Summary (CSV)
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleExport("csv", "detail")}
                    disabled={exporting === "csv-detail"}
                  >
                    {exporting === "csv-detail" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Export Detail (CSV)
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Alert>
              <AlertTitle>No upload yet</AlertTitle>
              <AlertDescription>Upload and review attendance before generating exports.</AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
