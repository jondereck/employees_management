"use client";

import * as React from "react";
import axios from "axios";
import { useParams } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { AlertModal } from "@/components/modals/alert-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/use-toast";

export type OfficeDivisionDto = {
  id: string;
  name: string;
  sortOrder: number;
  _count?: {
    plantillaPositions: number;
    employees: number;
  };
};

type Props = {
  onChanged?: () => void;
};

export default function OfficeDivisionsSection({ onChanged }: Props) {
  const params = useParams();
  const departmentId = String(params.departmentId);
  const officeId = String(params.officeId);

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [items, setItems] = React.useState<OfficeDivisionDto[]>([]);
  const [name, setName] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  const baseUrl = `/api/${departmentId}/offices/${officeId}/divisions`;

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get<OfficeDivisionDto[]>(baseUrl);
      setItems(res.data);
    } catch {
      toast({
        variant: "destructive",
        title: "Failed to load divisions",
        description: "Could not fetch office divisions.",
      });
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const notifyChanged = () => {
    onChanged?.();
  };

  const onCreate = async () => {
    if (!name.trim()) {
      toast({ variant: "destructive", title: "Name required", description: "Enter a division name." });
      return;
    }
    try {
      setSaving(true);
      await axios.post(baseUrl, {
        name: name.trim(),
        sortOrder: items.length,
      });
      setName("");
      await load();
      notifyChanged();
      toast({ title: "Division created" });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Could not create division",
        description: error?.response?.data?.error || "Request failed.",
      });
    } finally {
      setSaving(false);
    }
  };

  const onSaveEdit = async () => {
    if (!editingId) return;
    if (!editName.trim()) {
      toast({ variant: "destructive", title: "Name required" });
      return;
    }
    try {
      setSaving(true);
      await axios.patch(`${baseUrl}/${editingId}`, { name: editName.trim() });
      setEditingId(null);
      setEditName("");
      await load();
      notifyChanged();
      toast({ title: "Division updated" });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Could not update division",
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
      await axios.delete(`${baseUrl}/${deleteId}`);
      setDeleteId(null);
      await load();
      notifyChanged();
      toast({ title: "Division deleted" });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Could not delete division",
        description: error?.response?.data?.error || "Request failed.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <AlertModal
        isOpen={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={onDelete}
        loading={saving}
      />

      <div>
        <h3 className="text-lg font-semibold">Divisions</h3>
        <p className="text-sm text-muted-foreground">
          Optional sub-units under this office (e.g. BAC under Mayor&apos;s Office).
        </p>
      </div>
      <Separator />

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New division name"
          disabled={saving}
        />
        <Button type="button" onClick={onCreate} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          <span className="ml-2">Add</span>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading divisions…
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No divisions yet. Plantilla items can still sit directly under the office.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const inUse =
              (item._count?.plantillaPositions ?? 0) + (item._count?.employees ?? 0) > 0;
            const isEditing = editingId === item.id;
            return (
              <div
                key={item.id}
                className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                {isEditing ? (
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    disabled={saving}
                    className="sm:max-w-md"
                  />
                ) : (
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {item._count?.plantillaPositions ?? 0} plantilla · {item._count?.employees ?? 0} employees
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <Button type="button" size="sm" onClick={onSaveEdit} disabled={saving}>
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(null);
                          setEditName("");
                        }}
                        disabled={saving}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => {
                          setEditingId(item.id);
                          setEditName(item.name);
                        }}
                        disabled={saving}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="destructive"
                        onClick={() => setDeleteId(item.id)}
                        disabled={saving || inUse}
                        title={inUse ? "Clear linked plantilla/employees first" : "Delete division"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
