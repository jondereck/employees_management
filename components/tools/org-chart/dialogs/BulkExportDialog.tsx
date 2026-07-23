"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export type BulkExportOfficeOption = {
  id: string;
  name: string;
};

type BulkExportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offices: BulkExportOfficeOption[];
  isExporting?: boolean;
  onConfirm: (officeIds: string[]) => void | Promise<void>;
};

export function BulkExportDialog({
  open,
  onOpenChange,
  offices,
  isExporting = false,
  onConfirm,
}: BulkExportDialogProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setSelectedIds(offices.map((office) => office.id));
    }
  }, [open, offices]);

  const allSelected = useMemo(
    () => offices.length > 0 && selectedIds.length === offices.length,
    [offices.length, selectedIds.length]
  );

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? offices.map((office) => office.id) : []);
  };

  const toggleOne = (officeId: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...new Set([...prev, officeId])] : prev.filter((id) => id !== officeId)
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk export PDF</DialogTitle>
          <DialogDescription>
            Choose offices from the current chart. Each office becomes one page in a merged PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b pb-2">
            <Checkbox
              id="bulk-export-all"
              checked={allSelected}
              onCheckedChange={(value) => toggleAll(Boolean(value))}
              disabled={!offices.length || isExporting}
            />
            <Label htmlFor="bulk-export-all" className="text-sm font-medium">
              Select all ({offices.length})
            </Label>
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {offices.length ? (
              offices.map((office) => {
                const checked = selectedIds.includes(office.id);
                return (
                  <div key={office.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`bulk-export-${office.id}`}
                      checked={checked}
                      onCheckedChange={(value) => toggleOne(office.id, Boolean(value))}
                      disabled={isExporting}
                    />
                    <Label htmlFor={`bulk-export-${office.id}`} className="truncate text-sm">
                      {office.name}
                    </Label>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">No offices in the current chart.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Cancel
          </Button>
          <Button
            disabled={!selectedIds.length || isExporting}
            onClick={() => void onConfirm(selectedIds)}
          >
            {isExporting ? "Exporting…" : `Download PDF (${selectedIds.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
