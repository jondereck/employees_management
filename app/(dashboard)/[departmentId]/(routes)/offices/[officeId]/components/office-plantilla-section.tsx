"use client";

import * as React from "react";
import axios from "axios";
import { useParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, Minus, Pencil, Plus, Search, Trash2, Unlink } from "lucide-react";

import { AlertModal } from "@/components/modals/alert-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { SimpleTablePagination } from "@/components/ui/simple-table-pagination";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { useDebounce } from "@/hooks/use-debounce";

import type { OfficeDivisionDto } from "./office-divisions-section";
import {
  matchEmployeeTypeId,
  MAX_PLANTILLA_CREATE_QUANTITY,
  MAX_PLANTILLA_SALARY_GRADE,
  parsePlantillaPaste,
  sortPlantillaPositions,
  type PlantillaSortKey,
} from "@/lib/plantilla";

type EmployeeTypeOption = { id: string; name: string; value?: string | null };

type PastePreviewRow = {
  itemNumber: string | null;
  title: string;
  salaryGrade: number | null;
  statusLabel: string | null;
  occupantName: string | null;
  employeeTypeId: string | null;
  statusMatched: boolean;
  error?: string;
  /** Auto-link preview (Emp No suffix or name) */
  linkKind?: "unique" | "ambiguous" | "none";
  linkBy?: "bio" | "name" | null;
  linkEmployeeLabel?: string | null;
};

type PlantillaDto = {
  id: string;
  itemNumber: string;
  title: string;
  salaryGrade: number | null;
  isActive: boolean;
  officeDivisionId: string | null;
  employeeTypeId: string | null;
  officeDivision: { id: string; name: string } | null;
  employeeType: { id: string; name: string } | null;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    middleName?: string | null;
    employeeNo: string;
  } | null;
};

type FormState = {
  itemNumber: string;
  title: string;
  salaryGrade: string;
  officeDivisionId: string;
  employeeTypeId: string;
  isActive: boolean;
  quantity: string;
};

const emptyForm = (): FormState => ({
  itemNumber: "",
  title: "",
  salaryGrade: "",
  officeDivisionId: "none",
  employeeTypeId: "none",
  isActive: true,
  quantity: "1",
});

type Props = {
  refreshKey?: number;
};

export default function OfficePlantillaSection({ refreshKey = 0 }: Props) {
  const params = useParams();
  const departmentId = String(params.departmentId);
  const officeId = String(params.officeId);

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [items, setItems] = React.useState<PlantillaDto[]>([]);
  const [divisions, setDivisions] = React.useState<OfficeDivisionDto[]>([]);
  const [employeeTypes, setEmployeeTypes] = React.useState<EmployeeTypeOption[]>([]);
  const [filterDivision, setFilterDivision] = React.useState<string>("all");
  const [filterStatus, setFilterStatus] = React.useState<string>("all");
  const [sortKey, setSortKey] = React.useState<PlantillaSortKey>("itemNumber");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(10);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingOccupant, setEditingOccupant] = React.useState<PlantillaDto["employee"]>(null);
  const [linkQuery, setLinkQuery] = React.useState("");
  const debouncedLinkQuery = useDebounce(linkQuery, 300);
  const [linkResults, setLinkResults] = React.useState<
    Array<{
      id: string;
      employeeNo: string;
      firstName: string;
      lastName: string;
      middleName?: string | null;
      position?: string | null;
      officeName?: string | null;
      linkable?: boolean;
      linkedPlantilla?: { id: string; itemNumber: string | null; title: string } | null;
    }>
  >([]);
  const [linkSearching, setLinkSearching] = React.useState(false);
  const [linkSearchError, setLinkSearchError] = React.useState<string | null>(null);
  const [linking, setLinking] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(emptyForm());
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [pastePreview, setPastePreview] = React.useState<PastePreviewRow[] | null>(
    null
  );

  const plantillaUrl = `/api/${departmentId}/offices/${officeId}/plantilla`;
  const divisionsUrl = `/api/${departmentId}/offices/${officeId}/divisions`;
  const employeeTypesUrl = `/api/${departmentId}/employee_type`;

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const qs = new URLSearchParams();
      qs.set("activeOnly", "false");
      if (filterDivision !== "all" && filterDivision !== "none") {
        qs.set("divisionId", filterDivision);
      }
      if (filterStatus === "vacant" || filterStatus === "filled") {
        qs.set("status", filterStatus);
      }

      const [plantillaRes, divisionsRes, typesRes] = await Promise.all([
        axios.get<PlantillaDto[]>(`${plantillaUrl}?${qs.toString()}`),
        axios.get<OfficeDivisionDto[]>(divisionsUrl),
        axios.get<EmployeeTypeOption[]>(employeeTypesUrl),
      ]);

      let data = plantillaRes.data;
      if (filterDivision === "none") {
        data = data.filter((item) => !item.officeDivisionId);
      }
      setItems(data);
      setDivisions(divisionsRes.data);
      setEmployeeTypes(
        Array.isArray(typesRes.data)
          ? [...typesRes.data].sort((a, b) => a.name.localeCompare(b.name))
          : []
      );
    } catch {
      toast({
        variant: "destructive",
        title: "Failed to load plantilla",
        description: "Could not fetch plantilla items.",
      });
    } finally {
      setLoading(false);
    }
  }, [plantillaUrl, divisionsUrl, employeeTypesUrl, filterDivision, filterStatus]);

  React.useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const openCreate = () => {
    setEditingId(null);
    setEditingOccupant(null);
    setLinkQuery("");
    setLinkResults([]);
    setForm(emptyForm());
    setPastePreview(null);
    setDialogOpen(true);
  };

  const openEdit = (item: PlantillaDto) => {
    setEditingId(item.id);
    setEditingOccupant(item.employee);
    setLinkQuery("");
    setLinkResults([]);
    setPastePreview(null);
    setForm({
      itemNumber: item.itemNumber ?? "",
      title: item.title,
      salaryGrade: item.salaryGrade?.toString() ?? "",
      officeDivisionId: item.officeDivisionId ?? "none",
      employeeTypeId: item.employeeTypeId ?? item.employeeType?.id ?? "none",
      isActive: item.isActive,
      quantity: "1",
    });
    setDialogOpen(true);
  };

  const buildPastePreview = React.useCallback(
    (rows: ReturnType<typeof parsePlantillaPaste>["rows"]): PastePreviewRow[] =>
      rows.map((row) => {
        const employeeTypeId = matchEmployeeTypeId(row.statusLabel, employeeTypes);
        return {
          itemNumber: row.itemNumber,
          title: row.title,
          salaryGrade: row.salaryGrade,
          statusLabel: row.statusLabel,
          occupantName: row.occupantName,
          employeeTypeId,
          statusMatched: !row.statusLabel || Boolean(employeeTypeId),
          error: row.error,
        };
      }),
    [employeeTypes]
  );

  const enrichPastePreviewLinks = React.useCallback(
    async (rows: PastePreviewRow[]) => {
      const needsPreview = rows.some(
        (r) => r.itemNumber?.trim() || r.occupantName?.trim()
      );
      if (!needsPreview) return rows;

      try {
        const res = await axios.post<{
          matches: Array<{
            index: number;
            kind: "unique" | "ambiguous" | "none";
            linkBy: "bio" | "name" | null;
            employee?: {
              id: string;
              employeeNo: string;
              firstName: string;
              lastName: string;
            };
          }>;
        }>(`${plantillaUrl}/bio-link-preview`, {
          rows: rows.map((r) => ({
            itemNumber: r.itemNumber,
            occupantName: r.occupantName,
          })),
        });

        const byIndex = new Map(
          (res.data.matches ?? []).map((m) => [m.index, m])
        );

        return rows.map((row, index) => {
          const match = byIndex.get(index);
          if (!match) return row;
          const emp = match.employee;
          const linkEmployeeLabel = emp
            ? `${emp.lastName}, ${emp.firstName}${
                emp.employeeNo ? ` (${emp.employeeNo})` : ""
              }`
            : null;
          return {
            ...row,
            linkKind: match.kind,
            linkBy: match.linkBy,
            linkEmployeeLabel,
          };
        });
      } catch {
        return rows;
      }
    },
    [plantillaUrl]
  );

  const tryEnterPastePreview = (text: string): boolean => {
    const parsed = parsePlantillaPaste(text);
    if (parsed.mode !== "bulk") return false;
    if (parsed.error) {
      toast({
        variant: "destructive",
        title: "Paste too large",
        description: parsed.error,
      });
      return true;
    }
    const base = buildPastePreview(parsed.rows);
    setPastePreview(base);
    setForm((f) => ({ ...f, title: "" }));
    void enrichPastePreviewLinks(base).then((enriched) => {
      setPastePreview(enriched);
    });
    return true;
  };

  const toastCreateResult = (
    title: string,
    data: { linked?: number; warnings?: string[] } | undefined,
    extraParts: string[] = []
  ) => {
    const linked = typeof data?.linked === "number" ? data.linked : 0;
    const warnings = Array.isArray(data?.warnings) ? data.warnings : [];
    const parts = [...extraParts];
    if (linked > 0) parts.push(`Linked ${linked} employee${linked === 1 ? "" : "s"}`);
    if (warnings.length) parts.push(warnings.join("; "));
    toast({
      title,
      description: parts.length ? parts.join(" · ") : undefined,
    });
  };

  const onSavePaste = async () => {
    if (!pastePreview?.length) return;
    const invalid = pastePreview.find((row) => row.error);
    if (invalid) {
      toast({
        variant: "destructive",
        title: "Fix paste errors",
        description: invalid.error ?? "One or more rows are invalid.",
      });
      return;
    }

    const officeDivisionId =
      form.officeDivisionId === "none" ? null : form.officeDivisionId;
    const unmatched = pastePreview.filter(
      (r) => r.statusLabel && !r.statusMatched
    ).length;

    try {
      setSaving(true);
      const res = await axios.post(plantillaUrl, {
        items: pastePreview.map((row) => ({
          itemNumber: row.itemNumber,
          title: row.title,
          salaryGrade: row.salaryGrade,
          employeeTypeId: row.employeeTypeId,
          officeDivisionId,
          isActive: form.isActive,
          occupantName: row.occupantName,
        })),
      });
      toastCreateResult(
        `${pastePreview.length} plantilla items created`,
        res.data,
        unmatched > 0 ? [`${unmatched} status unmatched (set to None)`] : []
      );
      setPastePreview(null);
      setDialogOpen(false);
      await load();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Could not create plantilla items",
        description: error?.response?.data?.error || "Request failed.",
      });
    } finally {
      setSaving(false);
    }
  };

  const onSave = async () => {
    if (!form.title.trim()) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Position title is required.",
      });
      return;
    }

    let salaryGrade: number | null = null;
    if (form.salaryGrade.trim()) {
      const n = Number(form.salaryGrade);
      if (
        !Number.isFinite(n) ||
        !Number.isInteger(n) ||
        n < 1 ||
        n > MAX_PLANTILLA_SALARY_GRADE
      ) {
        toast({
          variant: "destructive",
          title: "Invalid salary grade",
          description: `Salary grade must be between 1 and ${MAX_PLANTILLA_SALARY_GRADE}.`,
        });
        return;
      }
      salaryGrade = n;
    }

    let quantity = 1;
    if (!editingId) {
      const q = Number(form.quantity);
      if (
        !Number.isFinite(q) ||
        !Number.isInteger(q) ||
        q < 1 ||
        q > MAX_PLANTILLA_CREATE_QUANTITY
      ) {
        toast({
          variant: "destructive",
          title: "Invalid quantity",
          description: `Quantity must be between 1 and ${MAX_PLANTILLA_CREATE_QUANTITY}.`,
        });
        return;
      }
      quantity = q;
    }

    const payload = {
      itemNumber: form.itemNumber.trim() || null,
      title: form.title.trim(),
      salaryGrade,
      salaryStep: null,
      officeDivisionId: form.officeDivisionId === "none" ? null : form.officeDivisionId,
      employeeTypeId: form.employeeTypeId === "none" ? null : form.employeeTypeId,
      isActive: form.isActive,
      ...(editingId ? {} : { quantity }),
    };

    try {
      setSaving(true);
      if (editingId) {
        await axios.patch(`${plantillaUrl}/${editingId}`, payload);
        toast({ title: "Plantilla item updated" });
      } else {
        const res = await axios.post(plantillaUrl, payload);
        toastCreateResult(
          quantity === 1
            ? "Plantilla item created"
            : `${quantity} plantilla items created`,
          res.data
        );
      }
      setDialogOpen(false);
      await load();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Could not save plantilla item",
        description: error?.response?.data?.error || "Request failed.",
      });
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!deleteId) return;
    try {
      setSaving(true);
      await axios.delete(`${plantillaUrl}/${deleteId}`);
      setDeleteId(null);
      await load();
      toast({ title: "Plantilla item deleted" });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Could not delete plantilla item",
        description: error?.response?.data?.error || "Request failed.",
      });
    } finally {
      setSaving(false);
    }
  };

  const occupantName = (item: PlantillaDto) => {
    if (!item.employee) return null;
    const mid = item.employee.middleName?.trim()
      ? ` ${item.employee.middleName.trim()[0]}.`
      : "";
    return `${item.employee.lastName}, ${item.employee.firstName}${mid}`;
  };

  const sortedItems = React.useMemo(
    () => sortPlantillaPositions(items, sortKey, sortDir),
    [items, sortKey, sortDir]
  );

  const pageCount = pageSize > 0 ? Math.max(1, Math.ceil(sortedItems.length / pageSize)) : 1;
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const pagedItems = React.useMemo(() => {
    const start = safePageIndex * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, safePageIndex, pageSize]);

  React.useEffect(() => {
    setPageIndex(0);
  }, [filterDivision, filterStatus, sortKey, sortDir]);

  React.useEffect(() => {
    if (!editingId || editingOccupant || !debouncedLinkQuery.trim()) {
      setLinkResults([]);
      setLinkSearching(false);
      setLinkSearchError(null);
      return;
    }
    let cancelled = false;
    setLinkSearching(true);
    setLinkSearchError(null);
    void axios
      .get<{
        results: Array<{
          id: string;
          employeeNo: string;
          firstName: string;
          lastName: string;
          middleName?: string | null;
          position?: string | null;
          officeName?: string | null;
          linkable?: boolean;
          linkedPlantilla?: {
            id: string;
            itemNumber: string | null;
            title: string;
          } | null;
        }>;
      }>(`${plantillaUrl}/link-candidates`, {
        params: { q: debouncedLinkQuery.trim(), limit: 20 },
      })
      .then((res) => {
        if (!cancelled) setLinkResults(res.data.results ?? []);
      })
      .catch((error: any) => {
        if (!cancelled) {
          setLinkResults([]);
          setLinkSearchError(
            error?.response?.data?.error ||
              error?.message ||
              "Search failed"
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLinkSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedLinkQuery, editingId, editingOccupant, plantillaUrl]);

  const onLinkEmployee = async (employeeId: string) => {
    if (!editingId) return;
    try {
      setLinking(true);
      const res = await axios.post(`${plantillaUrl}/${editingId}/link`, {
        employeeId,
      });
      setEditingOccupant(res.data?.employee ?? null);
      setLinkQuery("");
      setLinkResults([]);
      toast({ title: "Employee linked" });
      await load();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Could not link employee",
        description: error?.response?.data?.error || "Request failed.",
      });
    } finally {
      setLinking(false);
    }
  };

  const onUnlinkEmployee = async () => {
    if (!editingId) return;
    try {
      setLinking(true);
      await axios.delete(`${plantillaUrl}/${editingId}/link`);
      setEditingOccupant(null);
      toast({ title: "Occupant unlinked" });
      await load();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Could not unlink",
        description: error?.response?.data?.error || "Request failed.",
      });
    } finally {
      setLinking(false);
    }
  };

  const toggleSort = (key: PlantillaSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  };

  const SortHeader = ({
    label,
    column,
    className,
  }: {
    label: string;
    column: PlantillaSortKey;
    className?: string;
  }) => {
    const active = sortKey === column;
    const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
    return (
      <th className={className ?? "p-3 font-medium"}>
        <button
          type="button"
          className="inline-flex items-center gap-1 hover:text-foreground"
          onClick={() => toggleSort(column)}
        >
          {label}
          <Icon className={`h-3.5 w-3.5 ${active ? "opacity-100" : "opacity-40"}`} />
        </button>
      </th>
    );
  };

  return (
    <div className="space-y-4">
      <AlertModal
        isOpen={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={onDelete}
        loading={saving}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Plantilla Positions</h3>
          <p className="text-sm text-muted-foreground">
            Individual authorized items for this office. Division is optional.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add item
        </Button>
      </div>
      <Separator />

      <div className="flex flex-col gap-2 sm:flex-row">
        <Select value={filterDivision} onValueChange={setFilterDivision}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="Filter division" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All divisions</SelectItem>
            <SelectItem value="none">Office-level (no division)</SelectItem>
            {divisions.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Occupancy" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All occupancy</SelectItem>
            <SelectItem value="vacant">Vacant</SelectItem>
            <SelectItem value="filled">Filled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading plantilla…
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No plantilla items yet.</p>
      ) : (
        <div className="space-y-2">
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <SortHeader label="Item No." column="itemNumber" />
                <SortHeader label="Title" column="title" />
                <SortHeader label="Division" column="division" />
                <SortHeader label="Status" column="status" />
                <SortHeader label="SG" column="salaryGrade" />
                <SortHeader label="Occupancy" column="occupancy" />
                <th className="p-3 font-medium">Occupant</th>
                <th className="p-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedItems.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="p-3 font-mono text-xs">{item.itemNumber?.trim() || "—"}</td>
                  <td className="p-3">{item.title}</td>
                  <td className="p-3 text-muted-foreground">
                    {item.officeDivision?.name ?? "—"}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {item.employeeType?.name ?? "—"}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {item.salaryGrade != null ? `SG ${item.salaryGrade}` : "—"}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {!item.isActive && <Badge variant="secondary">Inactive</Badge>}
                      <Badge variant={item.employee ? "default" : "outline"}>
                        {item.employee ? "Filled" : "Vacant"}
                      </Badge>
                    </div>
                  </td>
                  <td className="p-3">
                    {item.employee ? (
                      <div>
                        <div>{occupantName(item)}</div>
                        {item.employee.employeeNo ? (
                          <div className="text-xs text-muted-foreground">
                            BIO {item.employee.employeeNo}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => openEdit(item)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="destructive"
                        disabled={Boolean(item.employee)}
                        title={item.employee ? "Release occupant first" : "Delete item"}
                        onClick={() => setDeleteId(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <SimpleTablePagination
          pageIndex={safePageIndex}
          pageSize={pageSize}
          totalCount={sortedItems.length}
          onPageIndexChange={setPageIndex}
          onPageSizeChange={setPageSize}
          label={`${sortedItems.length} plantilla item${sortedItems.length === 1 ? "" : "s"}`}
        />
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setPastePreview(null);
            setLinkQuery("");
            setLinkResults([]);
            setEditingOccupant(null);
          }
        }}
      >
        <DialogContent className={pastePreview ? "sm:max-w-2xl" : "sm:max-w-lg"}>
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? "Edit plantilla item"
                : pastePreview
                  ? `Paste preview (${pastePreview.length})`
                  : "Add plantilla item"}
            </DialogTitle>
          </DialogHeader>

          {pastePreview ? (
            <div className="grid gap-4 py-2">
              <p className="text-sm text-muted-foreground">
                Review rows below. Division and Active apply to all. After Create,
                employees are auto-linked when unique by Emp No item-number suffix
                (e.g. <span className="font-mono text-xs">1200040, A-1</span>) or
                by occupant name (first + last, e.g.{" "}
                <span className="font-mono text-xs">Randy A. Wapson</span>).
              </p>
              <div className="grid gap-2">
                <Label>Division</Label>
                <Select
                  value={form.officeDivisionId}
                  onValueChange={(v) => setForm((f) => ({ ...f, officeDivisionId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None (office-level)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (office-level)</SelectItem>
                    {divisions.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">Active</div>
                  <div className="text-xs text-muted-foreground">
                    Inactive items cannot be newly assigned to employees.
                  </div>
                </div>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                />
              </div>
              <div className="max-h-72 overflow-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80 text-left">
                    <tr>
                      <th className="p-2 font-medium">Item No.</th>
                      <th className="p-2 font-medium">Title</th>
                      <th className="p-2 font-medium">SG</th>
                      <th className="p-2 font-medium">Status</th>
                      <th className="p-2 font-medium">Occupant</th>
                      <th className="p-2 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pastePreview.map((row, index) => {
                      const matchedName = row.employeeTypeId
                        ? employeeTypes.find((t) => t.id === row.employeeTypeId)?.name
                        : null;
                      return (
                        <tr key={`${row.itemNumber ?? ""}-${row.title}-${index}`} className="border-t">
                          <td className="p-2 align-top font-mono text-xs">
                            {row.itemNumber?.trim() || "—"}
                          </td>
                          <td className="p-2 align-top">{row.title}</td>
                          <td className="p-2 align-top text-muted-foreground">
                            {row.salaryGrade ?? "—"}
                          </td>
                          <td className="p-2 align-top">
                            {matchedName ?? (
                              <span className="text-muted-foreground">None</span>
                            )}
                          </td>
                          <td className="p-2 align-top text-xs">
                            {row.occupantName?.trim() || (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-2 align-top text-xs text-muted-foreground">
                            {(() => {
                              const notes: string[] = [];
                              if (row.error) notes.push(row.error);
                              if (row.statusLabel && !row.statusMatched) {
                                notes.push(
                                  `Status “${row.statusLabel}” not found → None`
                                );
                              }
                              const hasLinkHint =
                                Boolean(row.itemNumber?.trim()) ||
                                Boolean(row.occupantName?.trim());
                              if (hasLinkHint) {
                                if (row.linkKind === "unique" && row.linkEmployeeLabel) {
                                  const via =
                                    row.linkBy === "name"
                                      ? "name"
                                      : row.linkBy === "bio"
                                        ? "Emp No"
                                        : "match";
                                  notes.push(
                                    `Will link (${via}): ${row.linkEmployeeLabel}`
                                  );
                                } else if (row.linkKind === "ambiguous") {
                                  notes.push(
                                    row.linkBy === "name"
                                      ? `Name matches 2+ employees — skip`
                                      : `Emp No suffix ${row.itemNumber} matches 2+ employees — skip`
                                  );
                                } else if (row.linkKind === "none") {
                                  if (row.occupantName?.trim()) {
                                    notes.push(
                                      `No unassigned employee named “${row.occupantName.trim()}”`
                                    );
                                  } else if (row.itemNumber?.trim()) {
                                    notes.push(
                                      `No unassigned Emp No ending with “${row.itemNumber.trim()}”`
                                    );
                                  }
                                }
                              }
                              return notes.length ? (
                                <div className="space-y-0.5">
                                  {notes.map((n) => (
                                    <div key={n}>{n}</div>
                                  ))}
                                </div>
                              ) : (
                                "—"
                              );
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 py-2">
              {!editingId ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Label htmlFor="quantity">Quantity</Label>
                    <p className="text-[11px] text-muted-foreground">
                      Create up to {MAX_PLANTILLA_CREATE_QUANTITY} identical slots.
                    </p>
                  </div>
                  <div
                    className="flex h-9 shrink-0 items-center gap-1 rounded-md border bg-muted/50 px-1.5"
                    title={`Create up to ${MAX_PLANTILLA_CREATE_QUANTITY} identical slots`}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                      disabled={Number(form.quantity || 1) <= 1 || saving}
                      aria-label="Decrease quantity"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          quantity: String(Math.max(1, Number(f.quantity || 1) - 1)),
                        }))
                      }
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <Input
                      id="quantity"
                      type="number"
                      min={1}
                      max={MAX_PLANTILLA_CREATE_QUANTITY}
                      value={form.quantity}
                      aria-label="Quantity"
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "");
                        if (!digits) {
                          setForm((f) => ({ ...f, quantity: "" }));
                          return;
                        }
                        const capped = Math.min(
                          Number(digits),
                          MAX_PLANTILLA_CREATE_QUANTITY
                        );
                        setForm((f) => ({
                          ...f,
                          quantity: String(Math.max(1, capped)),
                        }));
                      }}
                      placeholder="1"
                      className="h-7 w-9 border-0 bg-transparent px-0 text-center text-sm font-medium shadow-none focus-visible:ring-0"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                      disabled={
                        Number(form.quantity || 1) >= MAX_PLANTILLA_CREATE_QUANTITY ||
                        saving
                      }
                      aria-label="Increase quantity"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          quantity: String(
                            Math.min(
                              MAX_PLANTILLA_CREATE_QUANTITY,
                              Number(f.quantity || 1) + 1
                            )
                          ),
                        }))
                      }
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : null}
              <div className="grid gap-2">
                <Label htmlFor="itemNumber">Item number</Label>
                <Input
                  id="itemNumber"
                  value={form.itemNumber}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, itemNumber: e.target.value }))
                  }
                  placeholder="e.g. 12-1 (leave empty for Casual)"
                />
                <p className="text-[11px] text-muted-foreground">
                  Leave empty when there is no plantilla number (common for Casual).
                  {!editingId && Number(form.quantity) > 1
                    ? form.itemNumber.trim()
                      ? ` With qty ${form.quantity}, numbers will be ${form.itemNumber.trim()}-1 … ${form.itemNumber.trim()}-${form.quantity}.`
                      : " With qty > 1, item numbers stay empty on each slot."
                    : ""}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="title">Position title</Label>
                {editingId ? (
                  <Input
                    id="title"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Administrative Aide III"
                  />
                ) : (
                  <Textarea
                    id="title"
                    value={form.title}
                    rows={3}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value.includes("\n") || value.includes("\t")) {
                        if (tryEnterPastePreview(value)) return;
                      }
                      setForm((f) => ({ ...f, title: value }));
                    }}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData("text");
                      if (tryEnterPastePreview(text)) {
                        e.preventDefault();
                      }
                    }}
                    placeholder={
                      "e.g. Administrative Aide III\nOr paste: ItemNo  Title  SG  Status"
                    }
                  />
                )}
                {!editingId ? (
                  <p className="text-[11px] text-muted-foreground">
                    Paste from Excel/Word: Item No. (optional), Title, SG, Status
                    (tab or spaces). Opens a preview before creating.
                  </p>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={form.employeeTypeId}
                  onValueChange={(v) => setForm((f) => ({ ...f, employeeTypeId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {employeeTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  From Employee Type / Appointment Status. Auto-fills when linking an
                  employee.
                </p>
              </div>
              <div className="grid gap-2">
                <Label>Division</Label>
                <Select
                  value={form.officeDivisionId}
                  onValueChange={(v) => setForm((f) => ({ ...f, officeDivisionId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None (office-level)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (office-level)</SelectItem>
                    {divisions.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="salaryGrade">Salary grade</Label>
                <Input
                  id="salaryGrade"
                  type="number"
                  min={1}
                  max={MAX_PLANTILLA_SALARY_GRADE}
                  value={form.salaryGrade}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "");
                    if (!digits) {
                      setForm((f) => ({ ...f, salaryGrade: "" }));
                      return;
                    }
                    const capped = Math.min(Number(digits), MAX_PLANTILLA_SALARY_GRADE);
                    setForm((f) => ({ ...f, salaryGrade: String(capped) }));
                  }}
                  placeholder={`1–${MAX_PLANTILLA_SALARY_GRADE}`}
                />
                <p className="text-[11px] text-muted-foreground">
                  Max SG {MAX_PLANTILLA_SALARY_GRADE}.
                </p>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">Active</div>
                  <div className="text-xs text-muted-foreground">
                    Inactive items cannot be newly assigned to employees.
                  </div>
                </div>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                />
              </div>

              {editingId ? (
                <div className="grid gap-3 rounded-md border p-3">
                  <div>
                    <div className="text-sm font-medium">Linked employee</div>
                    <p className="text-xs text-muted-foreground">
                      Search and link an unassigned employee from this department.
                    </p>
                  </div>

                  {editingOccupant ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2">
                      <div className="min-w-0 text-sm">
                        <div className="font-medium">
                          {editingOccupant.lastName}, {editingOccupant.firstName}
                          {editingOccupant.middleName?.trim()
                            ? ` ${editingOccupant.middleName.trim()[0]}.`
                            : ""}
                        </div>
                        {editingOccupant.employeeNo ? (
                          <div className="text-xs text-muted-foreground">
                            BIO {editingOccupant.employeeNo}
                          </div>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={linking || saving}
                        onClick={() => void onUnlinkEmployee()}
                      >
                        {linking ? (
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Unlink className="mr-2 h-3.5 w-3.5" />
                        )}
                        Unlink
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={linkQuery}
                          onChange={(e) => setLinkQuery(e.target.value)}
                          placeholder="Search name or Emp No…"
                          className="pl-8"
                          disabled={linking || saving}
                        />
                      </div>
                      {linkSearching ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
                        </div>
                      ) : linkSearchError ? (
                        <p className="text-xs text-destructive">{linkSearchError}</p>
                      ) : linkQuery.trim() && linkResults.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No employees matched “{linkQuery.trim()}”.
                        </p>
                      ) : linkResults.length > 0 ? (
                        <div className="max-h-40 overflow-y-auto rounded-md border">
                          {linkResults.map((emp) => {
                            const canLink = emp.linkable !== false;
                            const linkedLabel = emp.linkedPlantilla
                              ? `Already linked${
                                  emp.linkedPlantilla.itemNumber
                                    ? ` · ${emp.linkedPlantilla.itemNumber}`
                                    : ""
                                }`
                              : "Already linked";
                            return (
                              <button
                                key={emp.id}
                                type="button"
                                disabled={linking || saving || !canLink}
                                className="flex w-full flex-col gap-0.5 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={() => {
                                  if (!canLink) return;
                                  void onLinkEmployee(emp.id);
                                }}
                              >
                                <span className="font-medium">
                                  {emp.lastName}, {emp.firstName}
                                  {emp.middleName?.trim()
                                    ? ` ${emp.middleName.trim()[0]}.`
                                    : ""}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {[
                                    emp.employeeNo ? `BIO ${emp.employeeNo}` : null,
                                    emp.officeName,
                                    emp.position,
                                    canLink ? null : linkedLabel,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          <DialogFooter>
            {pastePreview ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPastePreview(null)}
                  disabled={saving}
                >
                  Back
                </Button>
                <Button type="button" onClick={onSavePaste} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Create {pastePreview.length}
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={onSave} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {editingId
                    ? "Save changes"
                    : Number(form.quantity) > 1
                      ? `Create ×${form.quantity}`
                      : "Create"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
