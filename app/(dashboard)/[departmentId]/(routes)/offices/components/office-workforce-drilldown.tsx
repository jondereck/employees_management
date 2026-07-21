"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useOfficeWorkforceDetails } from "@/hooks/use-office-workforce";
import { getWorkforceViewLabel } from "@/lib/office-workforce-view-model";
import type { WorkforceDetailsView } from "@/lib/office-workforce";

export type WorkforceDrilldownSelection = {
  officeId: string;
  officeName: string;
  view: WorkforceDetailsView;
  openToken: number;
} | null;

type OfficeWorkforceDrilldownProps = {
  departmentId: string;
  selection: WorkforceDrilldownSelection;
  onClose: () => void;
};

export function OfficeWorkforceDrilldown({
  departmentId,
  selection,
  onClose,
}: OfficeWorkforceDrilldownProps) {
  const open = selection !== null;
  const { data, error, mutate } = useOfficeWorkforceDetails(
    departmentId,
    selection?.officeId ?? "",
    open ? selection?.view ?? null : null
  );
  const openToken = selection?.openToken ?? null;
  const [settledOpenToken, setSettledOpenToken] = useState<number | null>(
    null
  );
  const validationSettled =
    openToken !== null && settledOpenToken === openToken;

  useEffect(() => {
    if (openToken === null) return;

    let active = true;
    setSettledOpenToken(null);

    const revalidate = async () => {
      try {
        await mutate();
      } catch {
        // SWR exposes the request error for the dialog state below.
      } finally {
        if (active) setSettledOpenToken(openToken);
      }
    };

    void revalidate();
    return () => {
      active = false;
    };
  }, [mutate, openToken]);

  const retry = async () => {
    if (openToken === null) return;
    setSettledOpenToken(null);
    try {
      await mutate();
    } catch {
      // SWR exposes the request error for the dialog state below.
    } finally {
      setSettledOpenToken(openToken);
    }
  };

  const title = selection
    ? `${getWorkforceViewLabel(selection.view)} — ${selection.officeName}`
    : "Office workforce details";

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto motion-reduce:duration-0 motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Current workforce records for this office. Employee edit links open in
            a new tab.
          </DialogDescription>
        </DialogHeader>

        {!validationSettled && (
          <div className="space-y-3" aria-live="polite" aria-busy="true">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
              Loading workforce details…
            </div>
            {[0, 1, 2].map((item) => (
              <Skeleton
                key={item}
                className="h-24 w-full motion-reduce:animate-none"
              />
            ))}
          </div>
        )}

        {validationSettled && error && (
          <div
            className="rounded-md border border-destructive/40 bg-destructive/10 p-4"
            role="alert"
          >
            <p className="font-medium text-destructive">
              Workforce details could not be loaded.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Check your connection, then try again.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-3"
              onClick={() => void retry()}
            >
              Retry
            </Button>
          </div>
        )}

        {validationSettled && !error && data?.items.length === 0 && (
          <div className="rounded-md border border-dashed p-8 text-center">
            <p className="font-medium">No matching workforce records</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This office currently has no items in this view.
            </p>
          </div>
        )}

        {validationSettled && !error && data && data.items.length > 0 && (
          <ul className="space-y-3" aria-label={title}>
            {data.items.map((item) =>
              item.kind === "employee" ? (
                <li
                  key={item.employeeId}
                  className="rounded-md border bg-card p-4 text-card-foreground"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.position || "Position not recorded"}
                      </p>
                      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                        <div>
                          <dt className="font-medium">Assigned office</dt>
                          <dd className="text-muted-foreground">
                            {item.assignedOffice.name}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-medium">Plantilla office</dt>
                          <dd className="text-muted-foreground">
                            {item.plantillaOffice?.name ?? "Not linked"}
                          </dd>
                        </div>
                      </dl>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <a
                        href={`/${departmentId}/employees/${item.employeeId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Edit
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        <span className="sr-only">
                          {item.name} in a new tab
                        </span>
                      </a>
                    </Button>
                  </div>
                </li>
              ) : (
                <li
                  key={item.plantillaPositionId}
                  className="rounded-md border bg-card p-4 text-card-foreground"
                >
                  <p className="font-medium">{item.title}</p>
                  <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="font-medium">Item number</dt>
                      <dd className="text-muted-foreground">
                        {item.itemNumber ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium">Salary grade</dt>
                      <dd className="text-muted-foreground">
                        {item.salaryGrade ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium">Division</dt>
                      <dd className="text-muted-foreground">
                        {item.division?.name ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium">Type</dt>
                      <dd className="text-muted-foreground">
                        {item.employeeType?.name ?? "—"}
                      </dd>
                    </div>
                  </dl>
                </li>
              )
            )}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
