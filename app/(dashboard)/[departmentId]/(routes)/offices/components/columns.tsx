import React from "react"
import { ColumnDef } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { CellAction } from "./cell-actions"
import { Checkbox } from "@/components/ui/checkbox"
import { DataTableColumnHeader } from "@/components/ui/column-header"
import { Badge } from "@/components/ui/badge"
import type { WorkforceDetailsView } from "@/lib/office-workforce"

export type OfficesColumn = {
  id: string
  name: string,
  billboardLabel: string,
  bioIndexCode: string | null;
  plantillaCount: number;
  activePlantillaSlots: number;
  filledPlantillaSlots: number;
  vacantPlantillaSlots: number;
  assignedHereButPlantillaElsewhere: number;
  plantillaHereButAssignedElsewhere: number;
  crossOfficeCount: number;
  createdAt: string
}

type OpenDrilldown = (
  officeId: string,
  officeName: string,
  view: WorkforceDetailsView
) => void;

const countColumn = (
  accessorKey:
    | "activePlantillaSlots"
    | "filledPlantillaSlots"
    | "vacantPlantillaSlots",
  title: string,
  onOpenDrilldown?: OpenDrilldown,
  workforceLoaded = true
): ColumnDef<OfficesColumn> => ({
  accessorKey,
  header: ({ column }) => (
    <DataTableColumnHeader column={column} title={title} />
  ),
  cell: ({ row }) => {
    if (!workforceLoaded) {
      return (
        <span className="text-muted-foreground" aria-label={`${title} loading`}>
          …
        </span>
      );
    }
    const value = row.original[accessorKey];
    if (accessorKey !== "vacantPlantillaSlots" || !onOpenDrilldown) {
      return <span className="tabular-nums">{value}</span>;
    }
    return (
      <Button
        type="button"
        variant="link"
        className="h-auto min-h-10 p-2 tabular-nums"
        onClick={() =>
          onOpenDrilldown(row.original.id, row.original.name, "vacant")
        }
        aria-label={`View ${value} vacant plantilla positions for ${row.original.name}`}
      >
        {value}
      </Button>
    );
  },
  sortingFn: "basic",
  enableSorting: true,
});

export const createOfficeColumns = (
  onOpenDrilldown?: OpenDrilldown,
  workforceLoaded = true
): ColumnDef<OfficesColumn>[] => [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(v) => row.toggleSelected(!!v)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
  },
  {
    accessorKey: "billboardLabel",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Billboard" />,
    cell: ({ row }) => row.original.billboardLabel ?? "—",
  },

  {
    accessorKey: "bioIndexCode",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Bio Index Code" />,
    cell: ({ row }) => {
      const code = row.original.bioIndexCode;
      return code ? (
        <Badge variant="secondary" className="font-mono tracking-tight">
          {code}
        </Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    },
    sortingFn: "alphanumeric",
    enableSorting: true,
  },

  {
    accessorKey: "plantillaCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Total Plantilla" />
    ),
    cell: ({ row }) => row.original.plantillaCount,
    sortingFn: "basic",
    enableSorting: true,
  },
  countColumn(
    "activePlantillaSlots",
    "Active Plantilla",
    undefined,
    workforceLoaded
  ),
  countColumn("filledPlantillaSlots", "Filled", undefined, workforceLoaded),
  countColumn(
    "vacantPlantillaSlots",
    "Vacant",
    onOpenDrilldown,
    workforceLoaded
  ),
  {
    accessorKey: "crossOfficeCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Cross-office" />
    ),
    cell: ({ row }) =>
      !workforceLoaded ? (
        <span className="text-muted-foreground" aria-label="Cross-office loading">
          …
        </span>
      ) : (
        <div className="flex min-w-[12rem] flex-col items-start gap-1">
        <Button
          type="button"
          variant="link"
          className="h-auto min-h-9 justify-start p-1 text-xs"
          onClick={() =>
            onOpenDrilldown?.(
              row.original.id,
              row.original.name,
              "assigned-here-plantilla-elsewhere"
            )
          }
          disabled={!onOpenDrilldown}
          aria-label={`View ${row.original.assignedHereButPlantillaElsewhere} employees assigned to ${row.original.name} with plantilla elsewhere`}
        >
          Assigned here:{" "}
          <span className="tabular-nums">
            {row.original.assignedHereButPlantillaElsewhere}
          </span>
        </Button>
        <Button
          type="button"
          variant="link"
          className="h-auto min-h-9 justify-start p-1 text-xs"
          onClick={() =>
            onOpenDrilldown?.(
              row.original.id,
              row.original.name,
              "plantilla-here-assigned-elsewhere"
            )
          }
          disabled={!onOpenDrilldown}
          aria-label={`View ${row.original.plantillaHereButAssignedElsewhere} employees with plantilla in ${row.original.name} assigned elsewhere`}
        >
          Plantilla here:{" "}
          <span className="tabular-nums">
            {row.original.plantillaHereButAssignedElsewhere}
          </span>
        </Button>
        </div>
      ),
    sortingFn: "basic",
    enableSorting: true,
  },

  {
    accessorKey: "createdAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
  },
  {
    id: "actions",
    cell: ({ row }) => <CellAction data={row.original} />,
  },
];

export const columns = createOfficeColumns();
