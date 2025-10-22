import type { ExportTemplate } from '@/utils/export-templates';
import type { HeadsMode } from '@/utils/download-excel';

export type SortDir = "asc" | "desc";

export type SortLevel = {
  field: string;
  dir: SortDir;
};

export type ExportTemplateV2 = ExportTemplate & {
  templateVersion: 2;
  officesSelection: string[];
  sheetMode: "perOffice" | "merged" | "plain";
  sortLevels: SortLevel[];
  filterGroupMode: "office" | "bioIndex";
  headsMode: HeadsMode;
};
