"use client";

import { useEffect, useMemo, useState } from "react";

import type { DTRPreview, DTRSlot } from "@/types/autoDtr";

type StepPreviewProps = {
  value: DTRPreview;
  onBack: () => void;
  onReset: () => void;
};

type ExportFormat = "single" | "zip";

const DATE_COLUMNS = Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, "0"));

const ensureDateKey = (year: number, month: number, day: string) => {
  return `${year}-${String(month).padStart(2, "0")}-${day}`;
};

const formatSlotValue = (slot: DTRSlot | undefined, field: keyof DTRSlot) => {
  if (!slot) return "";
  const value = slot[field];
  if (typeof value !== "string") return "";
  return value;
};

export default function StepPreview({ value, onBack, onReset }: StepPreviewProps) {
  const [draft, setDraft] = useState<DTRPreview>(value);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("single");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const summary = useMemo(() => {
    const totalDays = draft.rows.reduce((acc, row) => acc + Object.keys(row.days).length, 0);
    return `${draft.rows.length} employees · ${totalDays} day entries`;
  }, [draft.rows]);

  const handleSlotChange = (employeeId: string, dateKey: string, field: keyof DTRSlot, nextValue: string) => {
    setDraft((prev) => {
      const rows = prev.rows.map((row) => {
        if (row.employeeId !== employeeId) return row;
        const days = { ...row.days };
        const existing = days[dateKey] ?? {};
        days[dateKey] = { ...existing, [field]: nextValue };
        return { ...row, days };
      });
      return { ...prev, rows };
    });
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const response = await fetch("/api/auto-dtr/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview: draft, format: exportFormat }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = exportFormat === "zip" ? "auto-dtr.zip" : "auto-dtr.xlsx";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export", error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Preview</h2>
          <p className="text-sm text-muted-foreground">{summary}</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="dtr-export-format"
              value="single"
              checked={exportFormat === "single"}
              onChange={() => setExportFormat("single")}
            />
            Single workbook
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="dtr-export-format"
              value="zip"
              checked={exportFormat === "zip"}
              onChange={() => setExportFormat("zip")}
            />
            Per-employee ZIP
          </label>
          <button
            type="button"
            className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? "Exporting…" : "Export"}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {draft.rows.map((row) => (
          <div key={row.employeeId} className="rounded-lg border p-4">
            <div className="mb-3 flex flex-col gap-1 text-sm">
              <span className="font-semibold">{row.name}</span>
              <span className="text-muted-foreground">{row.employeeNo}</span>
              {row.officeName ? <span className="text-muted-foreground">{row.officeName}</span> : null}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border text-xs">
                <thead>
                  <tr>
                    <th className="border px-2 py-1 text-left">Date</th>
                    <th className="border px-2 py-1">AM IN</th>
                    <th className="border px-2 py-1">AM OUT</th>
                    <th className="border px-2 py-1">PM IN</th>
                    <th className="border px-2 py-1">PM OUT</th>
                    <th className="border px-2 py-1">Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {DATE_COLUMNS.map((day) => {
                    const dateKey = ensureDateKey(draft.year, draft.month, day);
                    const slot = row.days[dateKey];
                    const disabled = Boolean(slot?.excused);
                    return (
                      <tr key={day} className={disabled ? "bg-muted/50" : undefined}>
                        <td className="border px-2 py-1 text-left">{day}</td>
                        {(["amIn", "amOut", "pmIn", "pmOut"] as (keyof DTRSlot)[]).map((field) => (
                          <td key={field} className="border px-1 py-1">
                            <input
                              type="text"
                              value={formatSlotValue(slot, field)}
                              onChange={(event) => handleSlotChange(row.employeeId, dateKey, field, event.target.value)}
                              disabled={disabled}
                              className="w-24 rounded border px-1 py-0.5 text-xs disabled:bg-muted"
                            />
                          </td>
                        ))}
                        <td className="border px-2 py-1">
                          <input
                            type="text"
                            value={slot?.excused ? slot.excused : slot?.remark ?? ""}
                            onChange={(event) =>
                              handleSlotChange(
                                row.employeeId,
                                dateKey,
                                slot?.excused ? "excused" : "remark",
                                event.target.value,
                              )
                            }
                            disabled={Boolean(slot?.excused)}
                            className="w-full rounded border px-1 py-0.5 text-xs disabled:bg-muted"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button type="button" className="rounded-md border px-4 py-2 text-sm" onClick={onBack}>
          Back
        </button>
        <button type="button" className="rounded-md border px-4 py-2 text-sm" onClick={onReset}>
          Start over
        </button>
      </div>
    </div>
  );
}
