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


import { Button } from "./button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { DataTableViewOptions } from "./column-toggle"





interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  offices: { id: string; name: string }[] 
  eligibilities: { id: string; name: string }[] 
  employeeTypes: { id: string; name: string}[] 
  
}

export function DataTable<TData, TValue>({
  columns,
  data,
  offices,
  eligibilities,
  employeeTypes


}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
    []
  );

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});


  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  })




  return (
    <div className="space-y-4">
      {/* <div className="flex justify-end items-end">
        <DataTableViewOptions table={table} />
      </div> */}

      <div className="flex items-center space-x-4 mb-4">
  <Select
    value={(table.getColumn("isArchived")?.getFilterValue() as string) ?? "all"}
    onValueChange={(value) => {
      table.getColumn("isArchived")?.setFilterValue(
        value === "all" ? undefined : value
      );
    }}
  >
    <SelectTrigger className="w-[120px]">
      <SelectValue placeholder="Filter status" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">All</SelectItem>
      <SelectItem value="Active">Active</SelectItem>
      <SelectItem value="Inactive">Inactive</SelectItem>
    </SelectContent>
  </Select>
</div>

<Select
  value={(table.getColumn("officeName")?.getFilterValue() as string) ?? "all"}
  onValueChange={(value) => {
    table.getColumn("officeName")?.setFilterValue(value === "all" ? undefined : value);
  }}
>
  <SelectTrigger className="w-[150px]">
    <SelectValue placeholder="Filter by office" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">All Offices</SelectItem>
    {offices.map((office) => (
      <SelectItem key={office.id} value={office.name}>
        {office.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>

<Select
  value={(table.getColumn("eligibility")?.getFilterValue() as string) ?? "all"}
  onValueChange={(value) => {
    table.getColumn("eligibility")?.setFilterValue(value === "all" ? undefined : value);
  }}
>
  <SelectTrigger className="w-[150px]">
    <SelectValue placeholder="Filter by Eligibility" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">All</SelectItem>
    {eligibilities.map((elig) => (
      <SelectItem key={elig.id} value={elig.name}>
        {elig.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>

<Select
  value={(table.getColumn("employeeType")?.getFilterValue() as string) ?? "all"}
  onValueChange={(value) => {
    table.getColumn("employeeType")?.setFilterValue(value === "all" ? undefined : value);
  }}
>
  <SelectTrigger className="w-[150px]">
    <SelectValue placeholder="Filter by Appointment" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">All</SelectItem>
    {employeeTypes.map((type) => (
      <SelectItem key={type.id} value={type.name}>
        {type.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>



      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
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

      <div className="flex items-center justify-between py-4 flex-wrap gap-4">
        <div className="text-sm text-muted-foreground flex-1">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <p className="hidden md:block text-sm font-medium">Rows per page</p>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => {
                table.setPageSize(Number(value));
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={table.getState().pagination.pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40, 50].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to first page</span>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to previous page</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to last page</span>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>

  )
}
