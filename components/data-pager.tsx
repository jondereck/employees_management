// components/data-pager.tsx
"use client";

import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  pageIndex: number;
  pageSize: number;
  pageCount: number;
  onPageChange: (nextIndex: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
};

function windowedPages(current: number, total: number, radius = 1) {
  const pages: number[] = [];
  const start = Math.max(1, current - radius);
  const end = Math.min(total, current + radius);
  for (let i = start; i <= end; i++) pages.push(i);
  return pages;
}

export default function DataPager({
  pageIndex,
  pageSize,
  pageCount,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 30, 40, 50, 100],
}: Props) {
  const canPrev = pageIndex > 0;
  const canNext = pageIndex < pageCount - 1;
  const current = pageIndex + 1;

  const pages = windowedPages(current, pageCount, 1); // shows [current-1, current, current+1]

  return (
    <div className="w-full flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="hidden md:inline text-sm text-muted-foreground">Rows per page</span>
        <Select value={`${pageSize}`} onValueChange={(v) => onPageSizeChange(parseInt(v))}>
          <SelectTrigger className="h-8 w-[84px]">
            <SelectValue placeholder={pageSize} />
          </SelectTrigger>
          <SelectContent side="top">
            {pageSizeOptions.map((v) => (
              <SelectItem key={v} value={`${v}`}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              aria-label="Previous"
              onClick={() => canPrev && onPageChange(current - 2)}
              className={!canPrev ? "pointer-events-none opacity-50" : ""}
            />
          </PaginationItem>

          {current > 2 && (
            <>
              <PaginationItem>
                <PaginationLink onClick={() => onPageChange(0)}>1</PaginationLink>
              </PaginationItem>
              {current > 3 && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}
            </>
          )}

          {pages.map((p) => (
            <PaginationItem key={p}>
              <PaginationLink isActive={p === current} onClick={() => onPageChange(p - 1)}>
                {p}
              </PaginationLink>
            </PaginationItem>
          ))}

          {current < pageCount - 1 && (
            <>
              {current < pageCount - 2 && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}
              <PaginationItem>
                <PaginationLink onClick={() => onPageChange(pageCount - 1)}>{pageCount}</PaginationLink>
              </PaginationItem>
            </>
          )}

          <PaginationItem>
            <PaginationNext
              aria-label="Next"
              onClick={() => canNext && onPageChange(current)}
              className={!canNext ? "pointer-events-none opacity-50" : ""}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
