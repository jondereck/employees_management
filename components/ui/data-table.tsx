"use client"


import { useEffect, useState } from "react"

import {
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Table as TanTable } from "@tanstack/react-table";


import { Button } from "./button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { DataTableViewOptions } from "./column-toggle"
import { usePersistentPagination } from "@/hooks/use-persistent-paginaton"
import DataPager from "../data-pager";



export type FloatingSelectionBarProps<TData> = {
  table: TanTable<TData>;
  departmentId: string;
  // (only add these if you truly need them here)
  // storageKey?: string;
  // syncPageToUrl?: boolean;
};


interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  offices?: { id: string; name: string }[]
  eligibilities?: { id: string; name: string }[]
  employeeTypes?: { id: string; name: string }[]
  searchKeys?: string[]
  renderExtra?: (table: TanTable<TData>) => React.ReactNode;
  storageKey?: string;
  /** sync page to URL (default true) */
  syncPageToUrl?: boolean;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  offices,
  eligibilities,
  employeeTypes,
  searchKeys,
  renderExtra,
  storageKey = "datatable_default",
  syncPageToUrl = true,


}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
    []
  );

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});

  const { pagination, setPagination, clampTo } = usePersistentPagination({
    storageKey,
    initial: { pageIndex: 0, pageSize: 10 },
    syncToUrl: syncPageToUrl,
  });



  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination, // <— controlled pagination

    // models
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),

    // critical to keep current page on edits/filters/sorts/data updates
    autoResetPageIndex: false,
    autoResetAll: false,
  })


  useEffect(() => {
    clampTo(table.getPageCount());
  }, [data.length, table, clampTo]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end items-end">
        <DataTableViewOptions table={table} />
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>

        <DataPager
          pageIndex={table.getState().pagination.pageIndex}
          pageSize={table.getState().pagination.pageSize}
          pageCount={table.getPageCount()}
          onPageChange={(i) => table.setPageIndex(i)}
          onPageSizeChange={(s) => table.setPageSize(s)}
        />
      </div>

      {renderExtra && renderExtra(table)}
    </div>
  );
}