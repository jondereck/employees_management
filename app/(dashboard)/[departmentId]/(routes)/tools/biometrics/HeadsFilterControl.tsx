"use client";

import { Button } from "@/components/ui/button";

export type HeadsFilterValue = "all" | "heads" | "nonHeads";

export type HeadsFilterControlProps = {
  value: HeadsFilterValue;
  onChange: (value: HeadsFilterValue) => void;
  disabled?: boolean;
};

const OPTIONS: Array<{ value: HeadsFilterValue; label: string }> = [
  { value: "all", label: "All" },
  { value: "heads", label: "Heads only" },
  { value: "nonHeads", label: "Exclude heads" },
];

const HeadsFilterControl = ({ value, onChange, disabled }: HeadsFilterControlProps) => {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="font-medium text-muted-foreground">Heads</span>
      <div className="inline-flex overflow-hidden rounded-md border">
        {OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={value === option.value ? "default" : "ghost"}
            className="rounded-none"
            aria-pressed={value === option.value}
            onClick={() => {
              if (option.value !== value) {
                onChange(option.value);
              }
            }}
            disabled={disabled}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default HeadsFilterControl;
