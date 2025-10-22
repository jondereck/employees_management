"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
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
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, GripVertical } from "lucide-react"
import { DataTableViewOptions } from "./column-toggle"
import { usePersistentPagination } from "@/hooks/use-persistent-paginaton"
import { cn } from "@/lib/utils"

const collectColumnIds = (columns: ColumnDef<any, any>[]): string[] => {
  const ids: string[] = []
  columns.forEach((col: any) => {
    if (col?.columns?.length) {
      ids.push(...collectColumnIds(col.columns))
      return
    }
    const id =
      (typeof col?.id === "string" && col.id) ??
      (typeof col?.accessorKey === "string" && col.accessorKey) ??
      (typeof col?.accessorKey === "number" && String(col.accessorKey)) ??
      undefined

    if (id) ids.push(id)
  })
  return ids
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  offices?: { id: string; name: string }[]
  eligibilities?: { id: string; name: string }[]
  employeeTypes?: { id: string; name: string }[]
  searchKeys?: string[]
  renderExtra?: (table: any) => React.ReactNode
  storageKey?: string
  /** sync page to URL (default true) */
  syncPageToUrl?: boolean
  enableColumnReorder?: boolean
}

export function DataTable<TData, TValue>({
  columns,
  data,
  renderExtra,
  storageKey = "datatable_default",
  syncPageToUrl = true,
  enableColumnReorder = false,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})

  const { pagination, setPagination } = usePersistentPagination({
    storageKey,
    initial: { pageIndex: 0, pageSize: 10 },
    syncToUrl: syncPageToUrl,
  })

  const baseColumnIds = useMemo(() => collectColumnIds(columns), [columns])
  const ORDER_STORAGE_KEY = `${storageKey}_column_order_v1`

  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    if (!enableColumnReorder) return baseColumnIds
    if (typeof window === "undefined") return baseColumnIds
    try {
      const raw = window.localStorage.getItem(ORDER_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.every((id) => typeof id === "string")) {
          return parsed
        }
      }
    } catch (error) {
      console.warn("Failed to read column order from storage", error)
    }
    return baseColumnIds
  })

  const [draggingColumn, setDraggingColumn] = useState<string | null>(null)
  const [dragIndicator, setDragIndicator] = useState<{ id: string; position: "left" | "right" } | null>(null)
  const [reorderMode, setReorderMode] = useState(false)
  const [armedColumn, setArmedColumn] = useState<string | null>(null)
  const activationTimerRef = useRef<number | null>(null)

  const getWorkingOrder = useCallback(() => {
    const orderFromState = columnOrder.length ? [...columnOrder] : []
    if (orderFromState.length) return orderFromState
    return [...baseColumnIds]
  }, [columnOrder, baseColumnIds])

  useEffect(() => {
    if (!enableColumnReorder) return
    setColumnOrder((prev) => {
      const filtered = prev.filter((id) => baseColumnIds.includes(id))
      const missing = baseColumnIds.filter((id) => !filtered.includes(id))
      const next = [...filtered, ...missing]
      const unchanged = next.length === prev.length && next.every((id, idx) => id === prev[idx])
      return unchanged ? prev : next
    })
  }, [enableColumnReorder, baseColumnIds])

  useEffect(() => {
    if (!enableColumnReorder) return
    if (typeof window === "undefined") return
    if (!columnOrder.length) return
    try {
      window.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(columnOrder))
    } catch (error) {
      console.warn("Failed to persist column order", error)
    }
  }, [columnOrder, enableColumnReorder, ORDER_STORAGE_KEY])

  const clearActivationTimer = useCallback(() => {
    if (activationTimerRef.current) {
      window.clearTimeout(activationTimerRef.current)
      activationTimerRef.current = null
    }
  }, [])

  const handleHeaderMouseDown = useCallback(
    (event: React.MouseEvent<HTMLTableCellElement>, columnId: string) => {
      if (!enableColumnReorder) return
      if (event.button === 2) {
        event.preventDefault()
        clearActivationTimer()
        activationTimerRef.current = window.setTimeout(() => {
          setReorderMode(true)
          setArmedColumn(columnId)
        }, 400)
      }
    },
    [enableColumnReorder, clearActivationTimer]
  )

  const handleHeaderMouseUp = useCallback(() => {
    clearActivationTimer()
  }, [clearActivationTimer])

  const handleHeaderMouseLeave = useCallback(() => {
    clearActivationTimer()
  }, [clearActivationTimer])

  const handleHeaderContextMenu = useCallback((event: React.MouseEvent) => {
    if (enableColumnReorder) {
      event.preventDefault()
    }
  }, [enableColumnReorder])

  useEffect(() => {
    return () => {
      clearActivationTimer()
    }
  }, [clearActivationTimer])

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
      ...(enableColumnReorder ? { columnOrder } : {}),
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    ...(enableColumnReorder ? { onColumnOrderChange: setColumnOrder } : {}),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false,
    autoResetAll: false,
  })

  const handleDragStart = useCallback(
    (event: React.DragEvent<HTMLElement>, columnId: string) => {
      if (!enableColumnReorder || !reorderMode) {
        event.preventDefault()
        return
      }
      setDraggingColumn(columnId)
      event.dataTransfer.effectAllowed = "move"
      event.dataTransfer.setData("text/plain", columnId)
    },
    [enableColumnReorder, reorderMode]
  )

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLTableCellElement>, targetId: string) => {
      if (!enableColumnReorder) return
      if (!draggingColumn || draggingColumn === targetId) return
      const rect = event.currentTarget.getBoundingClientRect()
      const midpoint = rect.left + rect.width / 2
      const position: "left" | "right" = event.clientX < midpoint ? "left" : "right"

      event.preventDefault()
      event.dataTransfer.dropEffect = "move"
      setDragIndicator((prev) => {
        if (prev && prev.id === targetId && prev.position === position) return prev
        return { id: targetId, position }
      })
    },
    [enableColumnReorder, draggingColumn]
  )

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLTableCellElement>, targetId: string) => {
      if (!enableColumnReorder) return
      event.preventDefault()
      const sourceId = draggingColumn || event.dataTransfer.getData("text/plain")
      const indicator = dragIndicator
      if (!sourceId || !indicator) {
        setDraggingColumn(null)
        setDragIndicator(null)
        return
      }

      const working = getWorkingOrder()
      if (!working.includes(sourceId) || !working.includes(targetId)) {
        setDraggingColumn(null)
        setDragIndicator(null)
        return
      }

      const next = working.filter((id) => id !== sourceId)
      const targetIndex = next.findIndex((id) => id === targetId)
      const insertIndex = indicator.position === "left" ? targetIndex : targetIndex + 1
      if (targetIndex === -1) {
        next.push(sourceId)
      } else {
        next.splice(insertIndex, 0, sourceId)
      }

      setColumnOrder(next)
      setDraggingColumn(null)
      setDragIndicator(null)
      setReorderMode(false)
      setArmedColumn(null)
    },
    [enableColumnReorder, draggingColumn, dragIndicator, getWorkingOrder]
  )

  const handleDragEnd = useCallback(() => {
    setDraggingColumn(null)
    setDragIndicator(null)
    setReorderMode(false)
    setArmedColumn(null)
  }, [])

  useEffect(() => {
    if (!enableColumnReorder) return
    const orderToApply = columnOrder.length ? columnOrder : baseColumnIds
    table.setColumnOrder(orderToApply)
  }, [table, columnOrder, baseColumnIds, enableColumnReorder])

  const hasCustomOrder = useMemo(() => {
    if (!enableColumnReorder) return false
    if (columnOrder.length !== baseColumnIds.length) return true
    return columnOrder.some((id, index) => id !== baseColumnIds[index])
  }, [enableColumnReorder, columnOrder, baseColumnIds])

  const columnVisibilityState = table.getState().columnVisibility
  const hasHiddenColumns = useMemo(() => {
    if (!columnVisibilityState) return false
    return Object.values(columnVisibilityState).some((value) => value === false)
  }, [columnVisibilityState])

  const canResetLayout = (enableColumnReorder && hasCustomOrder) || hasHiddenColumns

  const handleResetColumns = useCallback(() => {
    setDraggingColumn(null)
    setDragIndicator(null)
    setReorderMode(false)
    setArmedColumn(null)
    if (enableColumnReorder) {
      setColumnOrder([...baseColumnIds])
      if (typeof window !== "undefined") {
        try {
          window.localStorage.removeItem(ORDER_STORAGE_KEY)
        } catch (error) {
          console.warn("Failed to clear stored column order", error)
        }
      }
    }
    table.resetColumnVisibility?.()
  }, [enableColumnReorder, baseColumnIds, ORDER_STORAGE_KEY, table])

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-end">
        <DataTableViewOptions
          table={table}
          onResetColumns={handleResetColumns}
          canReset={canResetLayout}
        />
      </div>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className={cn(
                  enableColumnReorder &&
                    draggingColumn &&
                    "relative before:pointer-events-none before:absolute before:inset-0 before:rounded-md before:border before:border-dashed before:border-primary/40"
                )}
              >
                {headerGroup.headers.map((header) => {
                  const columnId = header.column.id
                  const isDragSource = enableColumnReorder && draggingColumn === columnId
                  const isDragTarget = enableColumnReorder && dragIndicator?.id === columnId && draggingColumn !== columnId
                  const isDropAllowed =
                    enableColumnReorder &&
                    draggingColumn &&
                    dragIndicator &&
                    (dragIndicator.id !== draggingColumn ||
                      dragIndicator.position === "left" ||
                      dragIndicator.position === "right")

                  return (
                    <TableHead
                      key={header.id}
                      draggable={enableColumnReorder}
                      onDragStart={
                        enableColumnReorder ? (event) => handleDragStart(event, columnId) : undefined
                      }
                      onDragOver={enableColumnReorder ? (event) => handleDragOver(event, columnId) : undefined}
                      onDrop={enableColumnReorder ? (event) => handleDrop(event, columnId) : undefined}
                      onDragLeave={undefined}
                      onDragEnd={enableColumnReorder ? handleDragEnd : undefined}
                      className={cn(
                        enableColumnReorder && "relative cursor-grab transition-colors",
                        isDragSource && "opacity-60 ring-2 ring-primary/60 shadow-sm",
                        isDragTarget &&
                          (isDropAllowed
                            ? "bg-emerald-50 ring-2 ring-dashed ring-emerald-500"
                            : "bg-red-50 ring-2 ring-dashed ring-red-400")
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : enableColumnReorder
                        ? (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">
                                <GripVertical className="h-4 w-4" />
                              </span>
                              <div className="flex-1">
                                {flexRender(header.column.columnDef.header, header.getContext())}
                              </div>
                              {isDragTarget && dragIndicator?.position === "left" && (
                                <span
                                  className={cn(
                                    "pointer-events-none absolute inset-y-1 left-0 w-[3px] rounded",
                                    isDropAllowed ? "bg-emerald-500" : "bg-red-400"
                                  )}
                                />
                              )}
                              {isDragTarget && dragIndicator?.position === "right" && (
                                <span
                                  className={cn(
                                    "pointer-events-none absolute inset-y-1 right-0 w-[3px] rounded",
                                    isDropAllowed ? "bg-emerald-500" : "bg-red-400"
                                  )}
                                />
                              )}
                            </div>
                          )
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  )
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

      <div className="flex flex-wrap items-center justify-between gap-4 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <p className="hidden text-sm font-medium md:block">Rows per page</p>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={table.getState().pagination.pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40, 50, 100].map((pageSize) => (
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

      {renderExtra && renderExtra(table)}
    </div>
  )
}
