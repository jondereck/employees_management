"use client";

import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  onPageIndexChange: (pageIndex: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  /** Shown left of controls, e.g. "12 item(s)". */
  label?: string;
};

/** Compact pagination bar matching Manage Employees / DataTable controls. */
export function SimpleTablePagination({
  pageIndex,
  pageSize,
  totalCount,
  onPageIndexChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 30, 40, 50],
  label,
}: Props) {
  const pageCount = pageSize > 0 ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1;
  const safeIndex = Math.min(pageIndex, pageCount - 1);
  const canPrev = safeIndex > 0;
  const canNext = safeIndex < pageCount - 1;

  if (totalCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-2">
      <p className="text-sm text-muted-foreground">
        {label ?? `${totalCount} row${totalCount === 1 ? "" : "s"}`}
        <span className="mx-2 text-muted-foreground/50">·</span>
        Page {safeIndex + 1} of {pageCount}
      </p>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <p className="hidden text-sm font-medium sm:block">Rows per page</p>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              onPageSizeChange(Number(value));
              onPageIndexChange(0);
            }}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="top">
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => onPageIndexChange(0)}
            disabled={!canPrev}
            aria-label="First page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => onPageIndexChange(Math.max(0, safeIndex - 1))}
            disabled={!canPrev}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => onPageIndexChange(Math.min(pageCount - 1, safeIndex + 1))}
            disabled={!canNext}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => onPageIndexChange(pageCount - 1)}
            disabled={!canNext}
            aria-label="Last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
