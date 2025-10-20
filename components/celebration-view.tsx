"use client";

import { useMemo, useState } from "react";
import { CelebrationGrid, type CelebrationPerson } from "./celebration-grid";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EmployeesColumn } from "@/app/(dashboard)/[departmentId]/(routes)/employees/components/columns";
import usePreviewModal from "@/app/(dashboard)/[departmentId]/(routes)/(frontend)/view/hooks/use-preview-modal";

export type CelebrationEntry = CelebrationPerson & {
  status: "upcoming" | "completed";
  eventDate: string;
  previewData: EmployeesColumn;
};

type FilterValue = "upcoming" | "completed" | "all";

type CelebrationViewProps = {
  title: string;
  subtitle?: string;
  description?: string;
  emptyMessage: string;
  people: CelebrationEntry[];
  defaultFilter?: FilterValue;
};

const FILTER_OPTIONS: { value: FilterValue; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
  { value: "all", label: "All" },
];

export function CelebrationView({
  title,
  subtitle,
  description,
  emptyMessage,
  people,
  defaultFilter = "upcoming",
}: CelebrationViewProps) {
  const [filter, setFilter] = useState<FilterValue>(defaultFilter);
  const previewModal = usePreviewModal();

  const counts = useMemo(
    () => ({
      upcoming: people.filter((person) => person.status === "upcoming").length,
      completed: people.filter((person) => person.status === "completed").length,
    }),
    [people]
  );

  const filtered = useMemo(() => {
    if (filter === "all") return people;
    return people.filter((person) => person.status === filter);
  }, [filter, people]);

  const handlePersonClick = (person: CelebrationPerson) => {
    const entry = person as CelebrationEntry;
    if (entry.previewData) {
      previewModal.onOpen(entry.previewData);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            value={filter}
            onValueChange={(value) => {
              if (value) setFilter(value as FilterValue);
            }}
            className="rounded-lg border bg-muted/40 p-1"
          >
            {FILTER_OPTIONS.map((option) => {
              const count =
                option.value === "upcoming"
                  ? counts.upcoming
                  : option.value === "completed"
                    ? counts.completed
                    : people.length;
              return (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  className="px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground data-[state=on]:bg-background data-[state=on]:text-foreground"
                >
                  {option.label}
                  <span className="ml-1 text-[10px] text-muted-foreground/80">({count})</span>
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        </div>
      </div>

      <CelebrationGrid
        title={title}
        subtitle={subtitle}
        description={description}
        people={filtered}
        emptyMessage={emptyMessage}
        onPersonClick={handlePersonClick}
      />
    </div>
  );
}

