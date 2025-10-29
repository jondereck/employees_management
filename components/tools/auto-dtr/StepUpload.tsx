"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { Check } from "lucide-react";

import type { DTRPreview } from "@/types/autoDtr";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import type { PeriodStepState } from "./StepPeriod";

export type UploadStepState = {
  files: File[];
  selectedEmployeeIds: string[];
  selectedOfficeIds: string[];
  splitTime: string;
  rounding: "none" | "5" | "10";
  preview: DTRPreview | null;
  isGenerating: boolean;
};

type StepUploadProps = {
  value: UploadStepState;
  period: PeriodStepState;
  onChange: (update: Partial<UploadStepState>) => void;
  onBack: () => void;
  onNext: () => void;
};

type OfficeOption = { id: string; name: string };
type EmployeeOption = { id: string; label: string };

const formatPreviewSummary = (preview: DTRPreview | null) => {
  if (!preview) return "No preview generated yet.";
  return `${preview.rows.length} employee${preview.rows.length === 1 ? "" : "s"} ready.`;
};

export default function StepUpload({ value, period, onChange, onBack, onNext }: StepUploadProps) {
  const previewSummary = useMemo(() => formatPreviewSummary(value.preview), [value.preview]);
  const params = useParams<{ departmentId?: string }>();
  const rawDepartmentId = params?.departmentId;
  const departmentId =
    typeof rawDepartmentId === "string"
      ? rawDepartmentId
      : Array.isArray(rawDepartmentId)
      ? rawDepartmentId[0] ?? ""
      : "";

  const [officePopoverOpen, setOfficePopoverOpen] = useState(false);
  const [employeePopoverOpen, setEmployeePopoverOpen] = useState(false);
  const [officeOptions, setOfficeOptions] = useState<OfficeOption[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [loadingOffices, setLoadingOffices] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  const officeNameMap = useMemo(() => new Map(officeOptions.map((option) => [option.id, option.name])), [officeOptions]);
  const employeeLabelMap = useMemo(() => new Map(employeeOptions.map((option) => [option.id, option.label])), [employeeOptions]);

  useEffect(() => {
    if (!departmentId) return;
    let cancelled = false;
    const loadOffices = async () => {
      setLoadingOffices(true);
      try {
        const response = await fetch(`/api/${departmentId}/offices`);
        if (!response.ok) throw new Error(response.statusText);
        const data = (await response.json()) as unknown;
        if (!Array.isArray(data)) return;
        const options: OfficeOption[] = data
          .map((entry) => {
            if (!entry || typeof entry !== "object") return null;
            const id = typeof (entry as { id?: unknown }).id === "string" ? (entry as { id: string }).id : null;
            const name = typeof (entry as { name?: unknown }).name === "string" ? (entry as { name: string }).name.trim() : "";
            if (!id) return null;
            return { id, name: name || id };
          })
          .filter(Boolean) as OfficeOption[];
        if (!cancelled) {
          setOfficeOptions(options.sort((a, b) => a.name.localeCompare(b.name)));
        }
      } catch (error) {
        console.warn("Failed to load offices", error);
        if (!cancelled) {
          setOfficeOptions([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingOffices(false);
        }
      }
    };
    loadOffices();
    return () => {
      cancelled = true;
    };
  }, [departmentId]);

  useEffect(() => {
    if (!departmentId) return;
    let cancelled = false;
    const loadEmployees = async () => {
      setLoadingEmployees(true);
      try {
        const response = await fetch(`/api/${departmentId}/employees?status=active`);
        if (!response.ok) throw new Error(response.statusText);
        const data = (await response.json()) as unknown;
        if (!Array.isArray(data)) return;
        const options: EmployeeOption[] = data
          .map((entry) => {
            if (!entry || typeof entry !== "object") return null;
            const id = typeof (entry as { id?: unknown }).id === "string" ? (entry as { id: string }).id : null;
            if (!id) return null;
            const firstName = typeof (entry as { firstName?: unknown }).firstName === "string"
              ? ((entry as { firstName: string }).firstName ?? "").trim()
              : "";
            const lastName = typeof (entry as { lastName?: unknown }).lastName === "string"
              ? ((entry as { lastName: string }).lastName ?? "").trim()
              : "";
            const employeeNo = typeof (entry as { employeeNo?: unknown }).employeeNo === "string"
              ? ((entry as { employeeNo: string }).employeeNo ?? "").trim()
              : "";
            const position = typeof (entry as { position?: unknown }).position === "string"
              ? ((entry as { position: string }).position ?? "").trim()
              : "";
            const labelBase = [lastName, firstName].filter(Boolean).join(", ") || position || id;
            const label = employeeNo ? `${labelBase} (${employeeNo})` : labelBase;
            return { id, label };
          })
          .filter(Boolean) as EmployeeOption[];
        if (!cancelled) {
          setEmployeeOptions(options.sort((a, b) => a.label.localeCompare(b.label)));
        }
      } catch (error) {
        console.warn("Failed to load employees", error);
        if (!cancelled) {
          setEmployeeOptions([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingEmployees(false);
        }
      }
    };
    loadEmployees();
    return () => {
      cancelled = true;
    };
  }, [departmentId]);

  const toggleOffice = useCallback(
    (id: string) => {
      const set = new Set(value.selectedOfficeIds);
      if (set.has(id)) {
        set.delete(id);
      } else {
        set.add(id);
      }
      onChange({ selectedOfficeIds: Array.from(set).sort((a, b) => a.localeCompare(b)) });
    },
    [onChange, value.selectedOfficeIds]
  );

  const toggleEmployee = useCallback(
    (id: string) => {
      const set = new Set(value.selectedEmployeeIds);
      if (set.has(id)) {
        set.delete(id);
      } else {
        set.add(id);
      }
      onChange({ selectedEmployeeIds: Array.from(set).sort((a, b) => a.localeCompare(b)) });
    },
    [onChange, value.selectedEmployeeIds]
  );

  const selectedOffices = useMemo(
    () => value.selectedOfficeIds.map((id) => ({ id, label: officeNameMap.get(id) ?? id })),
    [officeNameMap, value.selectedOfficeIds]
  );
  const selectedEmployees = useMemo(
    () => value.selectedEmployeeIds.map((id) => ({ id, label: employeeLabelMap.get(id) ?? id })),
    [employeeLabelMap, value.selectedEmployeeIds]
  );

  const handleFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    onChange({ files: Array.from(files) });
  };

  const handleGeneratePreview = async () => {
    if (value.isGenerating) return;
    onChange({ isGenerating: true });
    try {
      const metadata = {
        month: period.month,
        year: period.year,
        manualExclusions: period.manualExclusions,
        rounding: value.rounding,
        splitTime: value.splitTime,
        employeeIds: value.selectedEmployeeIds,
        officeIds: value.selectedOfficeIds,
        departmentId,
      };

      const formData = new FormData();
      formData.append("metadata", JSON.stringify(metadata));
      for (const file of value.files) {
        formData.append("files", file);
      }

      const response = await fetch("/api/auto-dtr/preview", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        let message = response.statusText;
        try {
          const payload = (await response.json()) as { error?: string };
          if (payload?.error) {
            message = payload.error;
          }
        } catch {
          message = await response.text();
        }
        throw new Error(message || "Unable to generate preview.");
      }
      const data = (await response.json()) as { preview: DTRPreview };
      onChange({ preview: data.preview });
      onNext();
    } catch (error) {
      console.error("Failed to generate preview", error);
      onChange({ preview: null });
    } finally {
      onChange({ isGenerating: false });
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4">
        <h2 className="text-base font-semibold">Upload biometrics logs</h2>
        <p className="text-sm text-muted-foreground">
          Use the same workbooks accepted by Biometrics uploader. Files are only listed here for context; parsing occurs in the
          server-side preview step.
        </p>
        <input
          type="file"
          accept=".xls,.xlsx"
          multiple
          onChange={handleFilesChange}
          className="mt-4"
        />
        {value.files.length ? (
          <ul className="mt-4 space-y-2 text-sm">
            {value.files.map((file) => (
              <li key={file.name} className="rounded border bg-muted/30 px-3 py-2">
                {file.name} <span className="text-xs text-muted-foreground">({Math.round(file.size / 1024)} KB)</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No files selected yet.</p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2 text-sm">
          <span className="font-medium">Include Employees</span>
          <Popover open={employeePopoverOpen} onOpenChange={setEmployeePopoverOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="justify-between">
                <span>
                  {value.selectedEmployeeIds.length
                    ? `${value.selectedEmployeeIds.length} selected`
                    : loadingEmployees
                    ? "Loading employees..."
                    : "Select employees"}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search employees" />
                <CommandList>
                  <CommandEmpty>No employees found.</CommandEmpty>
                  <CommandGroup>
                    {employeeOptions.map((employee) => {
                      const selected = value.selectedEmployeeIds.includes(employee.id);
                      return (
                        <CommandItem
                          key={employee.id}
                          value={`${employee.label} ${employee.id}`}
                          onSelect={() => toggleEmployee(employee.id)}
                          className="flex items-center gap-2"
                        >
                          <Check className={selected ? "h-4 w-4 opacity-100" : "h-4 w-4 opacity-0"} />
                          <span>{employee.label}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {selectedEmployees.length ? (
            <div className="flex flex-wrap gap-1">
              {selectedEmployees.map(({ id, label }) => (
                <Badge key={id} variant="secondary" className="text-[10px]">
                  {label}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Leave empty to include all employees.</span>
          )}
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <span className="font-medium">Include Offices</span>
          <Popover open={officePopoverOpen} onOpenChange={setOfficePopoverOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="justify-between">
                <span>
                  {value.selectedOfficeIds.length
                    ? `${value.selectedOfficeIds.length} selected`
                    : loadingOffices
                    ? "Loading offices..."
                    : "Select offices"}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search offices" />
                <CommandList>
                  <CommandEmpty>No offices found.</CommandEmpty>
                  <CommandGroup>
                    {officeOptions.map((office) => {
                      const selected = value.selectedOfficeIds.includes(office.id);
                      return (
                        <CommandItem
                          key={office.id}
                          value={`${office.name} ${office.id}`}
                          onSelect={() => toggleOffice(office.id)}
                          className="flex items-center gap-2"
                        >
                          <Check className={selected ? "h-4 w-4 opacity-100" : "h-4 w-4 opacity-0"} />
                          <span>{office.name}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {selectedOffices.length ? (
            <div className="flex flex-wrap gap-1">
              {selectedOffices.map(({ id, label }) => (
                <Badge key={id} variant="secondary" className="text-[10px]">
                  {label}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Leave empty to include all offices.</span>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium">Noon split time</span>
          <input
            type="time"
            value={value.splitTime}
            onChange={(event) => onChange({ splitTime: event.target.value })}
            className="rounded-md border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium">Rounding</span>
          <select
            value={value.rounding}
            onChange={(event) => onChange({ rounding: event.target.value as UploadStepState["rounding"] })}
            className="rounded-md border px-3 py-2"
          >
            <option value="none">None</option>
            <option value="5">Nearest 5 mins</option>
            <option value="10">Nearest 10 mins</option>
          </select>
        </label>
        <div className="flex flex-col justify-end text-sm text-muted-foreground">
          <p>{previewSummary}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button type="button" className="rounded-md border px-4 py-2 text-sm" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          disabled={!value.files.length || value.isGenerating}
          onClick={handleGeneratePreview}
        >
          {value.isGenerating ? "Generating…" : "Generate preview"}
        </button>
      </div>
    </div>
  );
}
