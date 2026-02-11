import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { FormItem, FormLabel, FormMessage } from "@/components/ui/form";

export function TimeButtonField({
  label,
  field,
  placeholder = "HH:mm",
}: {
  label: string;
  field: { value?: string; onChange: (v: string) => void };
  placeholder?: string;
}) {
  return (
    <FormItem>
      <FormLabel className="text-[10px] font-bold uppercase text-slate-500">
        {label}
      </FormLabel>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-9 w-full justify-between bg-white shadow-sm font-mono tabular-nums"
          >
            {field.value || placeholder}
            <Clock className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-auto p-3">
          <input
            type="time"
            step={60}
            className="rounded-md border px-2 py-1 text-sm font-mono"
            value={field.value ?? ""}
            onChange={(e) => field.onChange(e.target.value)}
          />
        </PopoverContent>
      </Popover>

      <FormMessage />
    </FormItem>
  );
}
