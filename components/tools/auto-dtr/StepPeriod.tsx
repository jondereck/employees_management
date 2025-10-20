"use client";

import { useEffect, useState } from "react";

import type { ManualExclusion } from "@/types/autoDtr";

export type PeriodStepState = {
  month: number;
  year: number;
  holidays: string[];
  manualExclusions: ManualExclusion[];
};

type StepPeriodProps = {
  value: PeriodStepState;
  onChange: (update: Partial<PeriodStepState>) => void;
  onNext: () => void;
};

const MONTH_OPTIONS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const storageKeyFor = (year: number, month: number) => `hrps.autoDtr.exclusions.${year}-${String(month).padStart(2, "0")}`;

type ManualDraft = Omit<ManualExclusion, "id">;

const createDraft = (): ManualDraft => ({
  dates: [],
  scope: "all",
  reason: "LEAVE",
});

export default function StepPeriod({ value, onChange, onNext }: StepPeriodProps) {
  const [manualHydratedKey, setManualHydratedKey] = useState<string | null>(null);
  const [manualDraft, setManualDraft] = useState<ManualDraft>(createDraft);
  const [dateInput, setDateInput] = useState("");
  const [noteInput, setNoteInput] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = storageKeyFor(value.year, value.month);
    if (manualHydratedKey === key) return;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as ManualExclusion[];
        if (Array.isArray(parsed)) {
          onChange({ manualExclusions: parsed });
        }
      }
    } catch (error) {
      console.warn("Failed to hydrate manual exclusions", error);
    }
    setManualHydratedKey(key);
  }, [manualHydratedKey, onChange, value.month, value.year]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = storageKeyFor(value.year, value.month);
    if (!manualHydratedKey || manualHydratedKey !== key) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value.manualExclusions));
    } catch (error) {
      console.warn("Failed to persist manual exclusions", error);
    }
  }, [manualHydratedKey, value.manualExclusions, value.month, value.year]);

  const handleAddManual = () => {
    const dates = dateInput
      .split(",")
      .map((token) => token.trim())
      .filter((token) => /^\d{4}-\d{2}-\d{2}$/.test(token));
    if (!dates.length) return;
    const entry: ManualExclusion = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      dates,
      scope: manualDraft.scope,
      officeIds: manualDraft.officeIds,
      employeeIds: manualDraft.employeeIds,
      reason: manualDraft.reason,
      note: noteInput || manualDraft.note,
    };
    onChange({ manualExclusions: [...value.manualExclusions, entry] });
    setManualDraft(createDraft());
    setDateInput("");
    setNoteInput("");
  };

  const handleRemoveManual = (id: string) => {
    onChange({ manualExclusions: value.manualExclusions.filter((entry) => entry.id !== id) });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium">Month</span>
          <select
            value={value.month}
            onChange={(event) => onChange({ month: Number(event.target.value) })}
            className="rounded-md border px-3 py-2"
          >
            {MONTH_OPTIONS.map((label, index) => (
              <option key={label} value={index + 1}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium">Year</span>
          <input
            type="number"
            min={2000}
            max={2100}
            value={value.year}
            onChange={(event) => onChange({ year: Number(event.target.value) })}
            className="rounded-md border px-3 py-2"
          />
        </label>
      </div>

      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Manual exclusions</h2>
            <p className="text-xs text-muted-foreground">
              Excuse dates from DTR computation. Enter dates as comma-separated yyyy-mm-dd values.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-2 text-xs">
            <span className="font-medium uppercase text-muted-foreground">Dates</span>
            <input
              value={dateInput}
              onChange={(event) => setDateInput(event.target.value)}
              placeholder="2024-04-01, 2024-04-02"
              className="rounded-md border px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-2 text-xs">
            <span className="font-medium uppercase text-muted-foreground">Scope</span>
            <select
              value={manualDraft.scope}
              onChange={(event) =>
                setManualDraft((prev) => ({
                  ...prev,
                  scope: event.target.value as ManualExclusion["scope"],
                }))
              }
              className="rounded-md border px-3 py-2"
            >
              <option value="all">All employees</option>
              <option value="offices">Offices (IDs)</option>
              <option value="employees">Employees (IDs)</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-xs">
            <span className="font-medium uppercase text-muted-foreground">Reason</span>
            <select
              value={manualDraft.reason}
              onChange={(event) =>
                setManualDraft((prev) => ({
                  ...prev,
                  reason: event.target.value as ManualExclusion["reason"],
                }))
              }
              className="rounded-md border px-3 py-2"
            >
              <option value="SUSPENSION">Suspension</option>
              <option value="OFFICE_CLOSURE">Office closure</option>
              <option value="CALAMITY">Calamity</option>
              <option value="TRAINING">Training</option>
              <option value="LEAVE">Leave</option>
              <option value="LOCAL_HOLIDAY">Local holiday</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {manualDraft.scope === "offices" ? (
            <label className="flex flex-col gap-2 text-xs">
              <span className="font-medium uppercase text-muted-foreground">Office IDs</span>
              <input
                value={(manualDraft.officeIds ?? []).join(", ")}
                onChange={(event) =>
                  setManualDraft((prev) => ({
                    ...prev,
                    officeIds: event.target.value
                      .split(",")
                      .map((token) => token.trim())
                      .filter(Boolean),
                  }))
                }
                placeholder="office-1, office-2"
                className="rounded-md border px-3 py-2"
              />
            </label>
          ) : null}

          {manualDraft.scope === "employees" ? (
            <label className="flex flex-col gap-2 text-xs">
              <span className="font-medium uppercase text-muted-foreground">Employee IDs</span>
              <input
                value={(manualDraft.employeeIds ?? []).join(", ")}
                onChange={(event) =>
                  setManualDraft((prev) => ({
                    ...prev,
                    employeeIds: event.target.value
                      .split(",")
                      .map((token) => token.trim())
                      .filter(Boolean),
                  }))
                }
                placeholder="emp-1, emp-2"
                className="rounded-md border px-3 py-2"
              />
            </label>
          ) : null}

          <label className="flex flex-col gap-2 text-xs">
            <span className="font-medium uppercase text-muted-foreground">Note</span>
            <input
              value={noteInput}
              onChange={(event) => setNoteInput(event.target.value)}
              placeholder="Optional note"
              className="rounded-md border px-3 py-2"
            />
          </label>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
            onClick={handleAddManual}
            disabled={!dateInput.trim()}
          >
            Add exclusion
          </button>
        </div>

        {value.manualExclusions.length ? (
          <ul className="mt-6 space-y-3">
            {value.manualExclusions.map((entry) => (
              <li key={entry.id} className="rounded-md border bg-muted/40 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{entry.reason}</p>
                    <p className="text-xs text-muted-foreground">{entry.dates.join(", ")}</p>
                    {entry.note ? <p className="text-xs text-muted-foreground">{entry.note}</p> : null}
                  </div>
                  <button
                    type="button"
                    className="text-xs text-destructive"
                    onClick={() => handleRemoveManual(entry.id)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">No manual exclusions added.</p>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          onClick={onNext}
        >
          Continue to uploads
        </button>
      </div>
    </div>
  );
}
