import { SlidersHorizontal, Table, ArrowUpDown, GitBranch, SearchCheck, BadgeInfo } from "lucide-react";

export const EXPORT_TABS = [
  { key: "filter", label: "Filter", icon: SlidersHorizontal },
  { key: "columns", label: "Columns", icon: Table },
  { key: "sort", label: "Sort", icon: ArrowUpDown },
  { key: "paths", label: "Paths", icon: GitBranch },
  { key: "findreplace", label: "Find & Replace", icon: SearchCheck },
  { key: "id", label: "ID", icon: BadgeInfo },
] as const;

export type ExportTabKey = typeof EXPORT_TABS[number]["key"];
