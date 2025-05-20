import { CaseUpper, CaseLower, Text, Undo2 } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ActionTooltip } from "@/components/ui/action-tooltip"

type Format = "uppercase" | "lowercase" | "capitalize" | "toggle"

export function FormatToggleGroup({
  value,
  onChange,
}: {
  value: Format
  onChange: (format: Format) => void
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(val) => {
        if (val) onChange(val as Format)
      }}
      className="flex gap-2"
    >
      <ActionTooltip label="Uppercase">
        <ToggleGroupItem
          value="uppercase"
          aria-label="Uppercase"
          className={value === "uppercase" ? "bg-primary text-white" : ""}
        >
          <CaseUpper className="w-6 h-6" />
        </ToggleGroupItem>
      </ActionTooltip>

      <ActionTooltip label="Lowercase">
        <ToggleGroupItem
          value="lowercase"
          aria-label="Lowercase"
          className={value === "lowercase" ? "bg-primary text-white" : ""}
        >
          <CaseLower className="w-6 h-6" />
        </ToggleGroupItem>
      </ActionTooltip>

      <ActionTooltip label="Capitalize Each Word">
        <ToggleGroupItem
          value="capitalize"
          aria-label="Capitalize Each Word"
          className={value === "capitalize" ? "bg-primary text-white" : ""}
        >
          <Text className="w-6 h-6" />
        </ToggleGroupItem>
      </ActionTooltip>

      <ActionTooltip label="Toggle Case">
        <ToggleGroupItem
          value="toggle"
          aria-label="Toggle Case"
          className={value === "toggle" ? "bg-primary text-white" : ""}
        >
          <Undo2 className="w-6 h-6" />
        </ToggleGroupItem>
      </ActionTooltip>
    </ToggleGroup>
  )
}
