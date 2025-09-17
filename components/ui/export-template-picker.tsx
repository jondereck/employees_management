// components/export-template-picker.tsx
import type { ExportTemplate } from "@/utils/export-templates";
import { getAllTemplates } from "@/utils/export-templates";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  value?: string;
  onApply: (tpl: ExportTemplate) => void;
  templates?: ExportTemplate[];  // <- NEW (optional)
  className?: string;
};

export default function ExportTemplatePicker({ value, onApply, templates, className }: Props) {
  const list = templates && templates.length ? templates : getAllTemplates(); // fallback
  const selected = list.find(t => t.id === value) ?? list[0];

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <Select
          defaultValue={selected?.id}
          onValueChange={(v) => {
            const t = list.find(x => x.id === v)!;
            onApply(t);
            localStorage.setItem("hrps.export.template", t.id);
          }}
        >
          <SelectTrigger className="w-[260px]">
            <SelectValue placeholder="Choose template" />
          </SelectTrigger>
          <SelectContent>
            {list.map(t => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {selected?.description && (
        <p className="mt-1 text-xs text-muted-foreground">{selected.description}</p>
      )}
    </div>
  );
}
