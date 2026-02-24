import { CaseUpper, CaseLower, Text, Undo2 } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ActionTooltip } from "@/components/ui/action-tooltip"
import { cn } from "@/lib/utils" // Import cn for clean class merging

type Format = "uppercase" | "lowercase" | "capitalize" | "toggle"

export function FormatToggleGroup({
  value,
  onChange,
  className, // Added className here
}: {
  value: Format
  onChange: (format: Format) => void
  className?: string // And here
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(val) => {
        if (val) onChange(val as Format)
      }}
      // Merged the incoming className with your default flex gap
      className={cn("flex gap-2", className)} 
    >
      <ActionTooltip label="Uppercase">
        <ToggleGroupItem
          value="uppercase"
          aria-label="Uppercase"
          className={cn(
            "rounded-xl transition-all", 
            value === "uppercase" ? "bg-slate-900 text-white shadow-md" : ""
          )}
        >
          <CaseUpper className="w-5 h-5" />
        </ToggleGroupItem>
      </ActionTooltip>

      <ActionTooltip label="Lowercase">
        <ToggleGroupItem
          value="lowercase"
          aria-label="Lowercase"
          className={cn(
            "rounded-xl transition-all",
            value === "lowercase" ? "bg-slate-900 text-white shadow-md" : ""
          )}
        >
          <CaseLower className="w-5 h-5" />
        </ToggleGroupItem>
      </ActionTooltip>

      <ActionTooltip label="Capitalize Each Word">
        <ToggleGroupItem
          value="capitalize"
          aria-label="Capitalize Each Word"
          className={cn(
            "rounded-xl transition-all",
            value === "capitalize" ? "bg-slate-900 text-white shadow-md" : ""
          )}
        >
          <Text className="w-5 h-5" />
        </ToggleGroupItem>
      </ActionTooltip>

      <ActionTooltip label="Toggle Case">
        <ToggleGroupItem
          value="toggle"
          aria-label="Toggle Case"
          className={cn(
            "rounded-xl transition-all",
            value === "toggle" ? "bg-slate-900 text-white shadow-md" : ""
          )}
        >
          <Undo2 className="w-5 h-5" />
        </ToggleGroupItem>
      </ActionTooltip>
    </ToggleGroup>
  )
}