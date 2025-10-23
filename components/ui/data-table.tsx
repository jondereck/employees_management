"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  TouchEvent as ReactTouchEvent,
} from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  Header,
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
import {
  DndContext,
  DragCancelEvent,
  DragEndEvent,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

class CtrlMouseSensor extends MouseSensor {
  static activators = [
    {
      eventName: "onMouseDown" as const,
      handler: ({ nativeEvent }: { nativeEvent: MouseEvent }) => nativeEvent.ctrlKey,
    },
  ]
}

class LongPressTouchSensor extends TouchSensor {
  static activators = [
    {
      eventName: "onTouchStart" as const,
      handler: () => true,
    },
  ]
}

const LEGACY_COLUMN_ID_ALIASES: Record<string, string> = {
  birthday_1: "age",
  dateHired: "yearsOfService",
}

const CTRL_LONG_PRESS_DELAY = 500

const sanitizeColumnOrder = (order: string[] | null | undefined, reference: string[]): string[] => {
  const preferred = Array.isArray(order) ? order : []
  const normalized = preferred
    .map((id) => LEGACY_COLUMN_ID_ALIASES[id] ?? id)
    .filter((id, index, array) => array.indexOf(id) === index)
  const filtered = normalized.filter((id) => reference.includes(id))
  const missing = reference.filter((id) => !filtered.includes(id))
  return [...filtered, ...missing]
}

const arraysEqual = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) return false
  return a.every((value, index) => value === b[index])
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
  columnOrderStorageKey?: string
}

export function DataTable<TData, TValue>({
  columns,
  data,
  renderExtra,
  storageKey = "datatable_default",
  syncPageToUrl = true,
  enableColumnReorder = false,
  columnOrderStorageKey,
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

  const ORDER_STORAGE_KEY = columnOrderStorageKey ?? `${storageKey}_column_order_v1`

  const [columnOrder, setColumnOrder] = useState<string[]>([])
  const [defaultColumnOrder, setDefaultColumnOrder] = useState<string[]>([])
  const [initialOrderLoaded, setInitialOrderLoaded] = useState(false)

  const [draggingColumn, setDraggingColumn] = useState<string | null>(null)
  const [isCtrlLongPressActive, setIsCtrlLongPressActive] = useState(false)
  const [touchReorderActive, setTouchReorderActive] = useState(false)
  const ctrlLongPressTimeoutRef = useRef<number | null>(null)

  const sensors = useSensors(
    useSensor(CtrlMouseSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(LongPressTouchSensor, {
      activationConstraint: { delay: 500, tolerance: 8 },
    })
  )

  const getWorkingOrder = useCallback(() => {
    if (columnOrder.length) return [...columnOrder]
    if (defaultColumnOrder.length) return [...defaultColumnOrder]
    return []
  }, [columnOrder, defaultColumnOrder])

  const clearCtrlLongPressTimeout = useCallback(() => {
    if (ctrlLongPressTimeoutRef.current !== null) {
      window.clearTimeout(ctrlLongPressTimeoutRef.current)
      ctrlLongPressTimeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!enableColumnReorder) {
      setIsCtrlLongPressActive(false)
      setTouchReorderActive(false)
      clearCtrlLongPressTimeout()
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Control") {
        if (ctrlLongPressTimeoutRef.current === null && !isCtrlLongPressActive) {
          ctrlLongPressTimeoutRef.current = window.setTimeout(() => {
            setIsCtrlLongPressActive(true)
            ctrlLongPressTimeoutRef.current = null
          }, CTRL_LONG_PRESS_DELAY)
        }
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Control") {
        clearCtrlLongPressTimeout()
        setIsCtrlLongPressActive(false)
      }
    }

    const handleWindowBlur = () => {
      clearCtrlLongPressTimeout()
      setIsCtrlLongPressActive(false)
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    window.addEventListener("blur", handleWindowBlur)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
      window.removeEventListener("blur", handleWindowBlur)
      clearCtrlLongPressTimeout()
    }
  }, [clearCtrlLongPressTimeout, enableColumnReorder, isCtrlLongPressActive])

  useEffect(() => {
    if (!enableColumnReorder) return
    setColumnOrder([])
    setDefaultColumnOrder([])
    setInitialOrderLoaded(false)
  }, [enableColumnReorder])

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

  const pageIndex = table.getState().pagination.pageIndex
  const pageSize = table.getState().pagination.pageSize
  const filteredRowCount = table.getFilteredRowModel().rows.length

  useEffect(() => {
    const pageCount = pageSize > 0 ? Math.ceil(filteredRowCount / pageSize) : 0
    if (pageCount <= 0) {
      setPagination((prev) => {
        if (prev.pageIndex === 0) return prev
        return { ...prev, pageIndex: 0 }
      })
      return
    }

    if (pageIndex >= pageCount) {
      const nextIndex = Math.max(0, pageCount - 1)
      setPagination((prev) => {
        if (prev.pageIndex === nextIndex) return prev
        return { ...prev, pageIndex: nextIndex }
      })
    }
  }, [pageIndex, pageSize, filteredRowCount, setPagination])

  useEffect(() => {
    if (!enableColumnReorder) return

    const referenceOrder = table.getAllLeafColumns().map((col) => col.id)

    setDefaultColumnOrder((prev) => {
      if (!prev.length) return referenceOrder
      const next = sanitizeColumnOrder(prev, referenceOrder)
      return arraysEqual(prev, next) ? prev : next
    })

    if (!initialOrderLoaded) {
      let storedOrder: string[] | null = null
      if (typeof window !== "undefined") {
        try {
          const raw = window.localStorage.getItem(ORDER_STORAGE_KEY)
          if (raw) {
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed) && parsed.every((id) => typeof id === "string")) {
              storedOrder = parsed
            }
          }
        } catch (error) {
          console.warn("Failed to read column order from storage", error)
        }
      }

      const next = sanitizeColumnOrder(storedOrder, referenceOrder)
      setColumnOrder(next)
      setInitialOrderLoaded(true)
      return
    }

    setColumnOrder((prev) => {
      const next = sanitizeColumnOrder(prev, referenceOrder)
      return arraysEqual(prev, next) ? prev : next
    })
  }, [enableColumnReorder, table, columns, initialOrderLoaded, ORDER_STORAGE_KEY])

  useEffect(() => {
    if (!enableColumnReorder) return
    const orderToApply = columnOrder.length ? columnOrder : defaultColumnOrder
    if (!orderToApply.length) return
    table.setColumnOrder(orderToApply)
  }, [table, columnOrder, defaultColumnOrder, enableColumnReorder])

  useEffect(() => {
    if (!enableColumnReorder || !initialOrderLoaded) return
    if (typeof window === "undefined") return
    if (!columnOrder.length) return
    try {
      window.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(columnOrder))
    } catch (error) {
      console.warn("Failed to persist column order", error)
    }
  }, [columnOrder, enableColumnReorder, ORDER_STORAGE_KEY, initialOrderLoaded])

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      if (!enableColumnReorder) return
      const columnId = event.active.id as string
      setDraggingColumn(columnId)
      const activatorType = event.activatorEvent?.type ?? ""
      if (activatorType.startsWith("touch")) {
        setTouchReorderActive(true)
      }
    },
    [enableColumnReorder]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!enableColumnReorder) return
      const { active, over } = event
      setDraggingColumn(null)
      setTouchReorderActive(false)
      if (!over || active.id === over.id) return

      const working = getWorkingOrder()
      const oldIndex = working.indexOf(active.id as string)
      const newIndex = working.indexOf(over.id as string)
      if (oldIndex === -1 || newIndex === -1) return

      const next = arrayMove(working, oldIndex, newIndex)
      setColumnOrder(next)
    },
    [enableColumnReorder, getWorkingOrder]
  )

  const handleDragCancel = useCallback(
    (_event: DragCancelEvent) => {
      if (!enableColumnReorder) return
      setDraggingColumn(null)
      setTouchReorderActive(false)
    },
    [enableColumnReorder]
  )

  const hasCustomOrder = useMemo(() => {
    if (!enableColumnReorder) return false
    if (!defaultColumnOrder.length) return false
    if (columnOrder.length !== defaultColumnOrder.length) return true
    return columnOrder.some((id, index) => id !== defaultColumnOrder[index])
  }, [enableColumnReorder, columnOrder, defaultColumnOrder])

  const columnVisibilityState = table.getState().columnVisibility
  const hasHiddenColumns = useMemo(() => {
    if (!columnVisibilityState) return false
    return Object.values(columnVisibilityState).some((value) => value === false)
  }, [columnVisibilityState])

  const canResetLayout = (enableColumnReorder && hasCustomOrder) || hasHiddenColumns

  const reorderModeActive =
    enableColumnReorder && (isCtrlLongPressActive || touchReorderActive || draggingColumn !== null)

  const handleResetColumns = useCallback(() => {
    setDraggingColumn(null)
    setTouchReorderActive(false)
    if (enableColumnReorder) {
      if (defaultColumnOrder.length) {
        setColumnOrder([...defaultColumnOrder])
      }
      if (typeof window !== "undefined") {
        try {
          window.localStorage.removeItem(ORDER_STORAGE_KEY)
        } catch (error) {
          console.warn("Failed to clear stored column order", error)
        }
      }
    }
    table.resetColumnVisibility?.()
  }, [enableColumnReorder, defaultColumnOrder, ORDER_STORAGE_KEY, table])

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
            {enableColumnReorder ? (
              <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
              >
                {table.getHeaderGroups().map((headerGroup) => {
                  const sortableHeaders = headerGroup.headers.filter((header) => !header.isPlaceholder)
                  const items = sortableHeaders.map((header) => header.column.id)

                  return (
                    <SortableContext
                      key={headerGroup.id}
                      items={items}
                      strategy={horizontalListSortingStrategy}
                    >
                      <TableRow
                        key={headerGroup.id}
                        className={cn(
                          reorderModeActive && "bg-primary/5 dark:bg-primary/10",
                          draggingColumn && "relative"
                        )}
                      >
                        {headerGroup.headers.map((header) =>
                          header.isPlaceholder ? (
                            <TableHead key={header.id} />
                          ) : (
                            <SortableColumnHeader
                              key={header.id}
                              header={header}
                              enableColumnReorder={enableColumnReorder}
                              reorderModeActive={reorderModeActive}
                              draggingColumn={draggingColumn}
                            />
                          )
                        )}
                      </TableRow>
                    </SortableContext>
                  )
                })}
              </DndContext>
            ) : (
              table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))
            )}
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

type SortableColumnHeaderProps<TData, TValue> = {
  header: Header<TData, TValue>
  enableColumnReorder: boolean
  reorderModeActive: boolean
  draggingColumn: string | null
}

type HandleListeners = {
  onMouseDown?: (event: ReactMouseEvent<HTMLButtonElement>) => void
  onMouseUp?: (event: ReactMouseEvent<HTMLButtonElement>) => void
  onMouseMove?: (event: ReactMouseEvent<HTMLButtonElement>) => void
  onKeyDown?: (event: ReactKeyboardEvent<HTMLButtonElement>) => void
  onKeyUp?: (event: ReactKeyboardEvent<HTMLButtonElement>) => void
  onTouchStart?: (event: ReactTouchEvent<HTMLButtonElement>) => void
  onTouchMove?: (event: ReactTouchEvent<HTMLButtonElement>) => void
  onTouchEnd?: (event: ReactTouchEvent<HTMLButtonElement>) => void
  onTouchCancel?: (event: ReactTouchEvent<HTMLButtonElement>) => void
}

function SortableColumnHeader<TData, TValue>({
  header,
  enableColumnReorder,
  reorderModeActive,
  draggingColumn,
}: SortableColumnHeaderProps<TData, TValue>) {
  const columnId = header.column.id
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: columnId,
    disabled: !enableColumnReorder,
  })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform ?? null),
    transition,
    zIndex: isDragging ? 5 : undefined,
  }

  const handleListeners = useMemo<HandleListeners>(() => {
    if (!enableColumnReorder || !listeners) {
      return {}
    }

    type GenericListener = (...args: any[]) => void

    const wrapMouseListener = (
      handler?: GenericListener
    ): HandleListeners["onMouseDown"] => {
      if (!handler) return undefined
      return (event) => {
        handler(event)
      }
    }

    const wrapKeyboardListener = (
      handler?: GenericListener
    ): HandleListeners["onKeyDown"] => {
      if (!handler) return undefined
      return (event) => {
        handler(event)
      }
    }

    const wrapTouchListener = (
      handler?: GenericListener
    ): HandleListeners["onTouchStart"] => {
      if (!handler) return undefined
      return (event) => {
        handler(event)
      }
    }

    return {
      onMouseDown: (event) => {
        if (!event.ctrlKey) {
          return
        }
        event.stopPropagation()
        listeners.onMouseDown?.(event)
      },
      onMouseUp: wrapMouseListener(listeners.onMouseUp as GenericListener | undefined),
      onMouseMove: wrapMouseListener(listeners.onMouseMove as GenericListener | undefined),
      onKeyDown: wrapKeyboardListener(listeners.onKeyDown as GenericListener | undefined),
      onKeyUp: wrapKeyboardListener(listeners.onKeyUp as GenericListener | undefined),
      onTouchStart: (event) => {
        event.stopPropagation()
        listeners.onTouchStart?.(event)
      },
      onTouchMove: wrapTouchListener(listeners.onTouchMove as GenericListener | undefined),
      onTouchEnd: wrapTouchListener(listeners.onTouchEnd as GenericListener | undefined),
      onTouchCancel: wrapTouchListener(listeners.onTouchCancel as GenericListener | undefined),
    }
  }, [enableColumnReorder, listeners])

  const isActiveColumn = draggingColumn === columnId
  const isHandleArmed = reorderModeActive || isActiveColumn
  const showHandle = enableColumnReorder && (reorderModeActive || isActiveColumn)

  return (
    <TableHead
      ref={setNodeRef}
      style={style}
      className={cn(
        enableColumnReorder && "relative transition-colors",
        reorderModeActive && "bg-emerald-50 dark:bg-emerald-900/10",
        isActiveColumn && "ring-2 ring-emerald-400/70",
        isDragging && "opacity-70"
      )}
    >
      <div className="flex items-center gap-2">
        {showHandle ? (
          <button
            type="button"
            ref={setActivatorNodeRef}
            className={cn(
              "inline-flex h-6 w-6 items-center justify-center rounded border border-dashed transition",
              isHandleArmed
                ? "cursor-grab border-emerald-400/70 bg-emerald-100 text-emerald-700 dark:border-emerald-500/70 dark:bg-emerald-900/20 dark:text-emerald-200"
                : "cursor-not-allowed border-border bg-muted/40 text-muted-foreground/80 dark:border-border dark:bg-muted/10 dark:text-muted-foreground/80"
            )}
            aria-label="Reorder column"
            title="Hold Ctrl until the handle appears, or long-press to reorder"
            {...attributes}
            {...handleListeners}
            onClick={(event) => {
              if (isHandleArmed) {
                event.stopPropagation()
              }
            }}
          >
            <GripVertical className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
        <div className="flex-1 truncate">
          {flexRender(header.column.columnDef.header, header.getContext())}
        </div>
      </div>
    </TableHead>
  )
}
