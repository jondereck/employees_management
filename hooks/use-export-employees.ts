"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import axios from "axios";
import { format } from "date-fns";
import { toast } from "sonner";

import { EmployeeWithRelations } from "@/lib/types";
import {
  buildWorkbook,
  ExportOfficeOption,
  partitionEmployeesByOffice,
  StylingOptions,
  writeWorkbookToFile,
  WorkbookColumn,
} from "@/utils/download-excel";

export type ExportColumnGroup = "Basic Info" | "Job Details" | "Address" | "Government IDs";

export interface ExportColumnDefinition extends WorkbookColumn {
  group: ExportColumnGroup;
}

type OfficeSelection = "all" | string[];

type ColumnGroupState = {
  name: ExportColumnGroup;
  columns: Array<ExportColumnDefinition & { checked: boolean }>;
};

type UseExportEmployeesOptions = {
  departmentId: string;
  offices: ExportOfficeOption[];
  employees?: EmployeeWithRelations[];
  columns: ExportColumnDefinition[];
  stylingOptions?: StylingOptions;
};

type UseExportEmployeesResult = {
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  selectedOfficeIds: string[];
  selectedOfficeItems: ExportOfficeOption[];
  isOfficeSelected: (id: string) => boolean;
  toggleOffice: (id: string) => void;
  selectAllOffices: () => void;
  selectionSummary: string;
  columnGroups: ColumnGroupState[];
  toggleColumn: (key: string) => void;
  selectAllColumns: () => void;
  clearAllColumns: () => void;
  selectedColumnKeys: string[];
  selectedColumnCount: number;
  totalColumnCount: number;
  isExportDisabled: boolean;
  exportDisabledReason: string | null;
  exportEmployees: () => Promise<void>;
  isExporting: boolean;
  perOfficeSheets: boolean;
  setPerOfficeSheets: Dispatch<SetStateAction<boolean>>;
  canToggleSheetMode: boolean;
  effectiveMode: "perOffice" | "singleSheet";
};

const OFFICES_STORAGE_KEY = "export.officesSelection";
const COLUMNS_STORAGE_KEY = "export.columnSelection.v1";

const sanitizeFilenamePart = (value: string) =>
  value
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "Office";

const paramsSerializer = (params: { offices?: string[] }) => {
  const search = new URLSearchParams();
  params.offices?.forEach((id) => search.append("offices", id));
  return search.toString();
};

export function useExportEmployees({
  departmentId,
  offices,
  employees,
  columns,
  stylingOptions,
}: UseExportEmployeesOptions): UseExportEmployeesResult {
  const [isOpen, setIsOpen] = useState(false);
  const [officeSelection, setOfficeSelection] = useState<OfficeSelection>(() => {
    if (typeof window === "undefined") return "all";
    try {
      const stored = localStorage.getItem(OFFICES_STORAGE_KEY);
      if (!stored) return "all";
      if (stored === "all") return "all";
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? (parsed as string[]) : "all";
    } catch {
      return "all";
    }
  });

  const [selectedColumns, setSelectedColumns] = useState<string[]>(() => {
    const allKeys = columns.map((column) => column.key);
    if (typeof window === "undefined") return allKeys;
    try {
      const stored = localStorage.getItem(COLUMNS_STORAGE_KEY);
      if (!stored) return allKeys;
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return allKeys;
      const allowed = new Set(allKeys);
      const filtered = (parsed as string[]).filter((key) => allowed.has(key));
      return filtered.length ? filtered : allKeys;
    } catch {
      return allKeys;
    }
  });

  useEffect(() => {
    try {
      if (officeSelection === "all") {
        localStorage.setItem(OFFICES_STORAGE_KEY, "all");
      } else {
        localStorage.setItem(OFFICES_STORAGE_KEY, JSON.stringify(officeSelection));
      }
    } catch {
      /* ignore */
    }
  }, [officeSelection]);

  useEffect(() => {
    const allKeys = columns.map((column) => column.key);
    setSelectedColumns((prev) => {
      const allowed = new Set(allKeys);
      const filtered = prev.filter((key) => allowed.has(key));
      if (filtered.length === prev.length && filtered.length > 0) return filtered;
      return filtered.length ? filtered : allKeys;
    });
  }, [columns]);

  useEffect(() => {
    try {
      localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(selectedColumns));
    } catch {
      /* ignore */
    }
  }, [selectedColumns]);

  const [isExporting, setIsExporting] = useState(false);
  const [perOfficeSheets, setPerOfficeSheets] = useState(true);

  const resolvedOfficeIds = useMemo(() => {
    if (officeSelection === "all") {
      return offices.map((office) => office.id);
    }
    const allowed = new Set(offices.map((office) => office.id));
    return officeSelection.filter((id) => allowed.has(id));
  }, [officeSelection, offices]);

  const selectedOfficeItems = useMemo(() => {
    if (officeSelection === "all") return offices;
    const wanted = new Set(resolvedOfficeIds);
    return offices.filter((office) => wanted.has(office.id));
  }, [officeSelection, offices, resolvedOfficeIds]);

  const selectedColumnDefs = useMemo(
    () => columns.filter((column) => selectedColumns.includes(column.key)),
    [columns, selectedColumns],
  );

  const columnGroups: ColumnGroupState[] = useMemo(() => {
    const grouped = new Map<ExportColumnGroup, Array<ExportColumnDefinition & { checked: boolean }>>();
    columns.forEach((column) => {
      const list = grouped.get(column.group) ?? [];
      list.push({ ...column, checked: selectedColumns.includes(column.key) });
      grouped.set(column.group, list);
    });
    return Array.from(grouped.entries()).map(([name, cols]) => ({ name, columns: cols }));
  }, [columns, selectedColumns]);

  const isOfficeSelected = useCallback(
    (id: string) => officeSelection === "all" || resolvedOfficeIds.includes(id),
    [officeSelection, resolvedOfficeIds],
  );

  const toggleOffice = useCallback(
    (id: string) => {
      setOfficeSelection((prev) => {
        const current = prev === "all" ? offices.map((office) => office.id) : prev;
        const hasId = current.includes(id);
        const next = hasId
          ? current.filter((value) => value !== id)
          : [...current, id];
        if (next.length === 0) return [];
        const unique = Array.from(new Set(next));
        return unique.length === offices.length ? "all" : unique;
      });
    },
    [offices],
  );

  const selectAllOffices = useCallback(() => setOfficeSelection("all"), []);

  const selectionSummary = useMemo(() => {
    if (officeSelection === "all" || resolvedOfficeIds.length === offices.length) {
      return "All offices";
    }
    if (resolvedOfficeIds.length === 0) {
      return "No offices selected";
    }
    if (resolvedOfficeIds.length === 1) {
      const office = offices.find((o) => o.id === resolvedOfficeIds[0]);
      return office ? office.name : "1 office selected";
    }
    return `${resolvedOfficeIds.length} offices selected`;
  }, [officeSelection, resolvedOfficeIds, offices]);

  const toggleColumn = useCallback((key: string) => {
    setSelectedColumns((prev) => {
      const hasKey = prev.includes(key);
      if (hasKey) {
        const next = prev.filter((current) => current !== key);
        return next;
      }
      return [...prev, key];
    });
  }, []);

  const selectAllColumns = useCallback(() => {
    setSelectedColumns(columns.map((column) => column.key));
  }, [columns]);

  const clearAllColumns = useCallback(() => {
    setSelectedColumns([]);
  }, []);

  const selectedColumnCount = selectedColumnDefs.length;
  const totalColumnCount = columns.length;

  const exportDisabledReason = useMemo(() => {
    if (selectedColumnDefs.length === 0) return "Select at least one column.";
    if (resolvedOfficeIds.length === 0) return "Select at least one office.";
    return null;
  }, [resolvedOfficeIds.length, selectedColumnDefs.length]);

  const effectiveMode: "perOffice" | "singleSheet" = useMemo(() => {
    if (resolvedOfficeIds.length <= 1) return "singleSheet";
    return perOfficeSheets ? "perOffice" : "singleSheet";
  }, [perOfficeSheets, resolvedOfficeIds.length]);

  const canToggleSheetMode = useMemo(
    () => resolvedOfficeIds.length > 1 || officeSelection === "all",
    [officeSelection, resolvedOfficeIds.length],
  );

  const exportEmployees = useCallback(async () => {
    const officeIds = (() => {
      if (officeSelection === "all") return offices.map((office) => office.id);
      if (officeSelection.length === 0) return offices.map((office) => office.id);
      return resolvedOfficeIds;
    })();

    if (selectedColumnDefs.length === 0 || officeIds.length === 0) return;

    const toastId = toast.loading("Preparing export…");
    setIsExporting(true);

    try {
      const shouldFetchAll = officeIds.length > 1;
      let data: EmployeeWithRelations[] = [];

      if (!shouldFetchAll) {
        const response = await axios.get<EmployeeWithRelations[]>(
          `/api/${departmentId}/employees`,
          {
            params: { offices: officeIds },
            paramsSerializer,
          },
        );
        data = response.data;
      } else if (employees && employees.length > 0) {
        data = employees;
      } else {
        const response = await axios.get<EmployeeWithRelations[]>(
          `/api/${departmentId}/employees`,
        );
        data = response.data;
      }

      const selectionForPartition: "all" | string[] =
        officeSelection === "all" || officeIds.length === offices.length ? "all" : officeIds;

      const employeesByOffice = partitionEmployeesByOffice(data, offices, selectionForPartition);

      const workbook = buildWorkbook({
        employeesByOffice,
        columns: selectedColumnDefs,
        stylingOptions,
        mode: effectiveMode,
        combinedSheetTitle:
          effectiveMode === "singleSheet"
            ? employeesByOffice.length === 1
              ? employeesByOffice[0].officeName
              : "All Offices"
            : undefined,
      });

      const now = new Date();
      const timestamp = format(now, "yyyy-MM-dd_HHmm");
      let filename = `Employees_Export_${timestamp}.xlsx`;

      if (selectionForPartition !== "all" && officeIds.length === 1) {
        const office = offices.find((item) => item.id === officeIds[0]);
        const short = sanitizeFilenamePart(
          office?.bioIndexCode ?? office?.shortName ?? office?.name ?? "Office",
        );
        filename = `Employees_${short}_${timestamp}.xlsx`;
      }

      writeWorkbookToFile(workbook, filename);
      toast.success("Export ready", { id: toastId });
      setIsOpen(false);
    } catch (error) {
      const message =
        axios.isAxiosError(error)
          ? error.response?.data?.message ?? error.message
          : error instanceof Error
            ? error.message
            : "Unknown error";
      toast.error("Export failed", { id: toastId, description: message });
    } finally {
      setIsExporting(false);
    }
  }, [
    officeSelection,
    offices,
    resolvedOfficeIds,
    selectedColumnDefs,
    stylingOptions,
    effectiveMode,
    departmentId,
    employees,
  ]);

  return {
    isOpen,
    openModal: () => setIsOpen(true),
    closeModal: () => setIsOpen(false),
    selectedOfficeIds: resolvedOfficeIds,
    selectedOfficeItems,
    isOfficeSelected,
    toggleOffice,
    selectAllOffices,
    selectionSummary,
    columnGroups,
    toggleColumn,
    selectAllColumns,
    clearAllColumns,
    selectedColumnKeys: selectedColumns,
    selectedColumnCount,
    totalColumnCount,
    isExportDisabled: Boolean(exportDisabledReason) || isExporting,
    exportDisabledReason,
    exportEmployees,
    isExporting,
    perOfficeSheets,
    setPerOfficeSheets,
    canToggleSheetMode,
    effectiveMode,
  };
}
