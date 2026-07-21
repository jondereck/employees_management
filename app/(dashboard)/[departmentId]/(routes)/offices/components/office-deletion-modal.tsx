"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { buildBulkOfficeReassignments } from "@/lib/office-deletion";

type Office = { id: string; name: string };
type DestinationOffice = Office & { divisions: Office[] };
type Reason = "assigned" | "designated" | "plantilla" | "division";
type PreviewEmployee = {
  id: string;
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  position: string;
  isArchived: boolean;
  reasons: Reason[];
  assignedOffice: Office;
  designationOffice: Office | null;
  plantillaOffice: Office | null;
  divisionName: string | null;
};
type DeletionPreview = {
  office: Office;
  employees: PreviewEmployee[];
  destinationOffices: DestinationOffice[];
};

const OFFICE_LEVEL_DIVISION = "__office_level__";

const reasonLabels: Record<Reason, string> = {
  assigned: "Assigned",
  designated: "Designated",
  plantilla: "Plantilla",
  division: "Division",
};

function employeeName(employee: PreviewEmployee) {
  return [
    employee.firstName,
    employee.middleName,
    employee.lastName,
    employee.suffix,
  ]
    .filter(Boolean)
    .join(" ");
}

async function readError(response: Response) {
  const data = (await response.json().catch(() => null)) as {
    error?: unknown;
    code?: unknown;
  } | null;
  return {
    message:
      typeof data?.error === "string"
        ? data.error
        : "There was a problem with your request.",
    code: typeof data?.code === "string" ? data.code : null,
  };
}

export function OfficeDeletionModal({
  isOpen,
  onClose,
  departmentId,
  officeId,
  officeName,
  onDeleted,
}: {
  isOpen: boolean;
  onClose: () => void;
  departmentId: string;
  officeId: string;
  officeName: string;
  onDeleted: () => void;
}) {
  const [preview, setPreview] = useState<DeletionPreview | null>(null);
  const [destinationOfficeId, setDestinationOfficeId] = useState("");
  const [destinationDivisionId, setDestinationDivisionId] = useState(
    OFFICE_LEVEL_DIVISION
  );
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewUrl = `/api/${departmentId}/offices/${officeId}/deletion-preview`;

  const loadPreview = useCallback(
    async (preserveError = false, signal?: AbortSignal) => {
      setLoading(true);
      if (!preserveError) setError(null);
      try {
        const response = await fetch(previewUrl, {
          cache: "no-store",
          signal,
        });
        if (!response.ok) {
          const problem = await readError(response);
          throw new Error(problem.message);
        }
        const data = (await response.json()) as DeletionPreview;
        setPreview(data);
        setDestinationOfficeId("");
        setDestinationDivisionId(OFFICE_LEVEL_DIVISION);
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load the deletion preview."
          );
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [previewUrl]
  );

  useEffect(() => {
    if (!isOpen) {
      setPreview(null);
      setDestinationOfficeId("");
      setDestinationDivisionId(OFFICE_LEVEL_DIVISION);
      setError(null);
      return;
    }
    const controller = new AbortController();
    void loadPreview(false, controller.signal);
    return () => controller.abort();
  }, [isOpen, loadPreview]);

  const selectedDestinationOffice = preview?.destinationOffices.find(
    (office) => office.id === destinationOfficeId
  );
  const hasAffectedEmployees = (preview?.employees.length ?? 0) > 0;
  const hasDestinationOffices = (preview?.destinationOffices.length ?? 0) > 0;

  const submit = async () => {
    if (!preview) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/${departmentId}/offices/${officeId}`,
        {
          method: "DELETE",
          headers: hasAffectedEmployees
            ? { "Content-Type": "application/json" }
            : undefined,
          body: hasAffectedEmployees
            ? JSON.stringify({
                reassignments: buildBulkOfficeReassignments(
                  preview.employees,
                  destinationOfficeId,
                  destinationDivisionId !== OFFICE_LEVEL_DIVISION
                    ? destinationDivisionId
                    : null
                ),
              })
            : undefined,
        }
      );
      if (!response.ok) {
        const problem = await readError(response);
        setError(problem.message);
        if (problem.code === "STALE_OFFICE_DELETION_PREVIEW") {
          setPreview(null);
          setDestinationOfficeId("");
          setDestinationDivisionId(OFFICE_LEVEL_DIVISION);
          await loadPreview(true);
        }
        return;
      }
      onClose();
      onDeleted();
    } catch {
      setError(
        "The office could not be deleted. Check your connection and try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const actionDisabled =
    loading ||
    submitting ||
    !preview ||
    (hasAffectedEmployees &&
      (!hasDestinationOffices || !destinationOfficeId));

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !submitting) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Delete {officeName}</DialogTitle>
          <DialogDescription>
            {hasAffectedEmployees
              ? "Choose one destination office and optional division to apply to every affected employee."
              : "This action cannot be undone."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto overscroll-contain px-6">
          {loading && !preview ? (
            <div className="space-y-3 py-2" aria-label="Loading deletion preview">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : null}

          {!loading && preview?.employees.length === 0 ? (
            <div className="rounded-md border bg-muted/40 p-4 text-sm">
              No employees are affected. Confirm to delete this office.
            </div>
          ) : null}

          {preview?.employees.length ? (
            <div className="space-y-3 pb-2">
              <section
                className="rounded-lg border bg-muted/30 p-4"
                aria-labelledby="bulk-reassignment-heading"
              >
                <h3 id="bulk-reassignment-heading" className="font-medium">
                  Apply to all employees
                </h3>
                <p className="text-sm text-muted-foreground">
                  This destination will be used for every employee listed
                  below.
                </p>

                <label
                  className="mt-3 block text-sm font-medium"
                  htmlFor="bulk-destination-office"
                >
                  Destination office <span aria-hidden="true">*</span>
                </label>
                <Select
                  value={destinationOfficeId}
                  onValueChange={(officeId) => {
                    setDestinationOfficeId(officeId);
                    setDestinationDivisionId(OFFICE_LEVEL_DIVISION);
                  }}
                  disabled={submitting || !hasDestinationOffices}
                >
                  <SelectTrigger
                    id="bulk-destination-office"
                    className="mt-1 min-h-11"
                    aria-required={true}
                    aria-label="Destination office for all affected employees"
                  >
                    <SelectValue placeholder="Select destination office" />
                  </SelectTrigger>
                  <SelectContent>
                    {preview.destinationOffices.map((office) => (
                      <SelectItem key={office.id} value={office.id}>
                        {office.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedDestinationOffice?.divisions.length ? (
                  <>
                    <label
                      className="mt-3 block text-sm font-medium"
                      htmlFor="bulk-destination-division"
                    >
                      Destination division (optional)
                    </label>
                    <Select
                      value={destinationDivisionId}
                      onValueChange={setDestinationDivisionId}
                      disabled={submitting}
                    >
                      <SelectTrigger
                        id="bulk-destination-division"
                        className="mt-1 min-h-11"
                        aria-required={false}
                        aria-label="Destination division for all assigned employees"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={OFFICE_LEVEL_DIVISION}>
                          Office level / No division
                        </SelectItem>
                        {selectedDestinationOffice.divisions.map((division) => (
                          <SelectItem key={division.id} value={division.id}>
                            {division.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Division applies to employees with the Assigned badge.
                    </p>
                  </>
                ) : null}
              </section>

              {preview.employees.map((employee) => (
                <section
                  key={employee.id}
                  className="rounded-lg border p-4"
                  aria-labelledby={`employee-${employee.id}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3
                        id={`employee-${employee.id}`}
                        className="font-medium"
                      >
                        {employeeName(employee)}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {employee.position || "No position recorded"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {employee.reasons.map((reason) => (
                        <Badge key={reason} variant="outline">
                          {reasonLabels[reason]}
                        </Badge>
                      ))}
                      {employee.isArchived ? (
                        <Badge variant="secondary">Archived</Badge>
                      ) : null}
                    </div>
                  </div>

                  <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="inline text-muted-foreground">
                        Assigned office:{" "}
                      </dt>
                      <dd className="inline">{employee.assignedOffice.name}</dd>
                    </div>
                    <div>
                      <dt className="inline text-muted-foreground">
                        Designation office:{" "}
                      </dt>
                      <dd className="inline">
                        {employee.designationOffice?.name ?? "None"}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline text-muted-foreground">
                        Plantilla office:{" "}
                      </dt>
                      <dd className="inline">
                        {employee.plantillaOffice?.name ?? "None"}
                      </dd>
                    </div>
                    {employee.divisionName ? (
                      <div>
                        <dt className="inline text-muted-foreground">
                          Division:{" "}
                        </dt>
                        <dd className="inline">{employee.divisionName}</dd>
                      </div>
                    ) : null}
                  </dl>

                </section>
              ))}
            </div>
          ) : null}

          {hasAffectedEmployees && !hasDestinationOffices ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              This office cannot be deleted because the department has no other
              office available for employee reassignment.
            </p>
          ) : null}

          {error ? (
            <div
              className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
              role="alert"
            >
              <p>{error}</p>
              {!preview ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 min-h-11"
                  onClick={() => void loadPreview()}
                  disabled={loading}
                >
                  Retry preview
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="min-h-11"
            onClick={submit}
            disabled={actionDisabled}
          >
            {submitting
              ? "Deleting…"
              : hasAffectedEmployees
              ? "Move employees & delete office"
              : "Delete office"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
