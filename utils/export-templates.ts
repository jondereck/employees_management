// utils/export-templates.ts
import type { Column, IdColumnSource, PositionReplaceRule } from "@/utils/download-excel";

export type UserTemplate = Omit<ExportTemplate, "id"> & { id: string };
export type TemplateId = "hr-core" | "plantilla" | "payroll" | "gov-ids";

export type ExportTemplate = {
  id: string;
  name: string;
  description?: string;
  selectedKeys: string[];
  columnOrder?: Column[];                       // if omitted, use parent's columnOrder
  statusFilter?: "all" | "active" | "retired";
  appointmentFilters?: string[] | "all";
  idColumnSource?: IdColumnSource;
  positionReplaceRules?: PositionReplaceRule[];
  sheetName?: string;
};

export const EXPORT_TEMPLATES: ExportTemplate[] = [
  {
    id: "hr-core",
    name: "HR Core",
    description: "Basic identity + office + plantilla + position",
    selectedKeys: [
      "employeeNo","lastName","firstName","middleName","officeId","plantilla","position",
      "birthday","age","dateHired","yearsOfService","status","appointment","eligibility", 
      
    ],
    statusFilter: "active",
    idColumnSource: "employeeNo",
    sheetName: "HR Core",
  },
  {
    id: "plantilla",
    name: "Plantilla",
    description: "Plantilla view with computed salary",
    selectedKeys: [
      "employeeNo","lastName","firstName","officeId","plantilla","position",
      "salaryExport","salarySourceExport","employeeTypeId","isArchived"
    ],
    statusFilter: "all",
    idColumnSource: "bio",
    sheetName: "Plantilla",
  },
  {
    id: "payroll",
    name: "Payroll",
    description: "Salary-centric export for payroll sheets",
    selectedKeys: [
      "employeeNo","lastName","firstName","officeId","plantilla","position",
      "salaryExport","salarySourceExport","salaryGrade","salaryStep",
      "tinNo","pagIbigNo","philHealthNo"
    ],
    statusFilter: "active",
    idColumnSource: "employeeNo",
    sheetName: "Payroll",
  },
  {
    id: "gov-ids",
    name: "Government IDs",
    description: "ID numbers + basic identity",
    selectedKeys: [
      "employeeNo","lastName","firstName","officeId","position",
      "gsisNo","tinNo","philHealthNo","pagIbigNo"
    ],
    statusFilter: "all",
    idColumnSource: "bio",
    sheetName: "Gov IDs",
  },
];




const USER_KEY = "hrps.user.templates";

// Safe read (handles SSR and bad JSON)
export function loadUserTemplates(): UserTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function getAllTemplates(): ExportTemplate[] {
  // merge built-ins + user-defined; user ids won’t clash with fixed ones if you prefix with "user:"
  const users = loadUserTemplates();
  return [...EXPORT_TEMPLATES, ...users];
}

// Your existing saver (slightly hardened)
export function saveTemplateToLocalStorage(
  name: string,
  state: {
    selectedKeys: string[];
    statusFilter: "all" | "active" | "retired";
    idColumnSource: "uuid" | "bio" | "employeeNo";
    appointmentFilters: string[] | "all";
    positionReplaceRules: PositionReplaceRule[];
    sheetName?: string;
  }
) {
  if (typeof window === "undefined") return;
  const id = `user:${name.toLowerCase().trim().replace(/\s+/g, "-")}`;
  const tpl: UserTemplate = { id, name, ...state, sheetName: state.sheetName ?? "Sheet1" };
  const arr = loadUserTemplates();

  // upsert by id (so saving with the same name overwrites)
  const idx = arr.findIndex(t => t.id === id);
  if (idx >= 0) arr[idx] = tpl; else arr.push(tpl);

  localStorage.setItem(USER_KEY, JSON.stringify(arr));
}

export function deleteUserTemplate(id: string) {
  if (typeof window === "undefined") return;
  const arr = loadUserTemplates().filter(t => t.id !== id);
  localStorage.setItem(USER_KEY, JSON.stringify(arr));
}
