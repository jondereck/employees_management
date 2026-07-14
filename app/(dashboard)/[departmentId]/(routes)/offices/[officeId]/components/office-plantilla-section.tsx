"use client";

import * as React from "react";
import axios from "axios";
import { useParams } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";

import type { OfficeDivisionDto } from "./office-divisions-section";

type PlantillaDto = {
  id: string;
  itemNumber: string;
  title: string;
  salaryGrade: number | null;
  salaryStep: number | null;
  isActive: boolean;
  officeDivisionId: string | null;
  officeDivision: { id: string; name: string } | null;
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
  salaryStep: string;
  officeDivisionId: string;
  isActive: boolean;
};

const emptyForm = (): FormState => ({
  itemNumber: "",
  title: "",
  salaryGrade: "",
  salaryStep: "",
  officeDivisionId: "none",
  isActive: true,
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
  const [filterDivision, setFilterDivision] = React.useState<string>("all");
  const [filterStatus, setFilterStatus] = React.useState<string>("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>(emptyForm());
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  const plantillaUrl = `/api/${departmentId}/offices/${officeId}/plantilla`;
  const divisionsUrl = `/api/${departmentId}/offices/${officeId}/divisions`;

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

      const [plantillaRes, divisionsRes] = await Promise.all([
        axios.get<PlantillaDto[]>(`${plantillaUrl}?${qs.toString()}`),
        axios.get<OfficeDivisionDto[]>(divisionsUrl),
      ]);

      let data = plantillaRes.data;
      if (filterDivision === "none") {
        data = data.filter((item) => !item.officeDivisionId);
      }
      setItems(data);
      setDivisions(divisionsRes.data);
    } catch {
      toast({
        variant: "destructive",
        title: "Failed to load plantilla",
        description: "Could not fetch plantilla items.",
      });
    } finally {
      setLoading(false);
    }
  }, [plantillaUrl, divisionsUrl, filterDivision, filterStatus]);

  React.useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (item: PlantillaDto) => {
    setEditingId(item.id);
    setForm({
      itemNumber: item.itemNumber,
      title: item.title,
      salaryGrade: item.salaryGrade?.toString() ?? "",
      salaryStep: item.salaryStep?.toString() ?? "",
      officeDivisionId: item.officeDivisionId ?? "none",
      isActive: item.isActive,
    });
    setDialogOpen(true);
  };

  const onSave = async () => {
    if (!form.itemNumber.trim() || !form.title.trim()) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Item number and title are required.",
      });
      return;
    }

    const payload = {
      itemNumber: form.itemNumber.trim(),
      title: form.title.trim(),
      salaryGrade: form.salaryGrade ? Number(form.salaryGrade) : null,
      salaryStep: form.salaryStep ? Number(form.salaryStep) : null,
      officeDivisionId: form.officeDivisionId === "none" ? null : form.officeDivisionId,
      isActive: form.isActive,
    };

    try {
      setSaving(true);
      if (editingId) {
        await axios.patch(`${plantillaUrl}/${editingId}`, payload);
        toast({ title: "Plantilla item updated" });
      } else {
        await axios.post(plantillaUrl, payload);
        toast({ title: "Plantilla item created" });
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
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
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
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">Item No.</th>
                <th className="p-3 font-medium">Title</th>
                <th className="p-3 font-medium">Division</th>
                <th className="p-3 font-medium">SG/Step</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Occupant</th>
                <th className="p-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="p-3 font-mono text-xs">{item.itemNumber}</td>
                  <td className="p-3">{item.title}</td>
                  <td className="p-3 text-muted-foreground">
                    {item.officeDivision?.name ?? "—"}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {item.salaryGrade != null
                      ? `SG ${item.salaryGrade}${item.salaryStep != null ? ` / Step ${item.salaryStep}` : ""}`
                      : "—"}
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
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit plantilla item" : "Add plantilla item"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="itemNumber">Item number</Label>
              <Input
                id="itemNumber"
                value={form.itemNumber}
                onChange={(e) => setForm((f) => ({ ...f, itemNumber: e.target.value }))}
                placeholder="e.g. 12-1"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="title">Position title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Administrative Aide III"
              />
            </div>
            <div className="grid gap-2">
              <Label>Division (optional)</Label>
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
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="salaryGrade">Salary grade</Label>
                <Input
                  id="salaryGrade"
                  type="number"
                  min={1}
                  max={33}
                  value={form.salaryGrade}
                  onChange={(e) => setForm((f) => ({ ...f, salaryGrade: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="salaryStep">Salary step</Label>
                <Input
                  id="salaryStep"
                  type="number"
                  min={1}
                  max={8}
                  value={form.salaryStep}
                  onChange={(e) => setForm((f) => ({ ...f, salaryStep: e.target.value }))}
                />
              </div>
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
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={onSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingId ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
