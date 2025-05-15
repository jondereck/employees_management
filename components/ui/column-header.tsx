import {
  ArrowDownIcon,
  ArrowUpIcon,
  CaretSortIcon,
  EyeNoneIcon,
} from "@radix-ui/react-icons"
import { Column } from "@tanstack/react-table"

import { cn } from "@/lib/utils"

import { Button } from "./button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu"

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>
  title: string
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return (
      <div className={cn("px-3 py-2 text-left font-semibold text-gray-700", className)}>
        {title}
      </div>
    )
  }

  return (
    <div className={cn("flex items-center space-x-2 px-1 py-1", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="group -ml-3 h-8 rounded-md px-2 flex items-center gap-1
              hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500
              transition-colors duration-150"
          >
            <span className="font-semibold text-gray-800">{title}</span>
            {column.getIsSorted() === "desc" ? (
              <ArrowDownIcon
                className="ml-1 h-4 w-4 text-indigo-600 transition-transform duration-200"
                aria-label="Sorted descending"
              />
            ) : column.getIsSorted() === "asc" ? (
              <ArrowUpIcon
                className="ml-1 h-4 w-4 text-indigo-600 transition-transform duration-200"
                aria-label="Sorted ascending"
              />
            ) : (
              <CaretSortIcon
                className="ml-1 h-4 w-4 text-gray-400 group-hover:text-indigo-600 transition-colors duration-200"
                aria-label="Not sorted"
              />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[150px]">
          <DropdownMenuItem
            onClick={() => column.toggleSorting(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <ArrowUpIcon className="h-4 w-4 text-gray-600" />
            Ascending
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => column.toggleSorting(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <ArrowDownIcon className="h-4 w-4 text-gray-600" />
            Descending
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => column.toggleVisibility(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <EyeNoneIcon className="h-4 w-4 text-gray-600" />
            Hide Column
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
