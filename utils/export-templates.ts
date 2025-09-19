// utils/export-templates.ts
import type { Column, IdColumnSource, PositionReplaceRule } from "@/utils/download-excel";

export type UserTemplate = Omit<ExportTemplate, "id"> & { id: string };
export type TemplateId = "hr-core" | "plantilla" | "payroll" | "gov-ids";

export type AppointmentFilterValue =
  | "all"
  | "permanent"
  | "co-terminous"
  | "casual"
  | "contractual"
  | "job-order"
  | "temporary";

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
      "employeeNo", "lastName", "firstName", "middleName", "officeId", "plantilla", "position",
      "birthday", "age", "dateHired", "yearsOfService", "status", "appointment", "eligibility",

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
      "employeeNo", "lastName", "firstName", "middleName", "suffix", "nickname", "officeId", "position", "barangay", "city", "emergencyContactName", "emergencyContactNumber",
      "gsisNo", "tinNo", "philHealthNo", "pagIbigNo", "imagePath", "qrPath",
      "birthday", "age", "dateHired", "yearsOfService",
    ],
    statusFilter: "active",
    appointmentFilters: ["Permanent", "Coterminous"],
    idColumnSource: "employeeNo",
    sheetName: "Plantilla",
  },

  {
    id: "gov-ids",
    name: "Government IDs",
    description: "ID numbers + basic identity",
    selectedKeys: [
      "employeeNo", "lastName", "firstName", "middleName", "suffix", "nickname", "officeId", "position", "barangay", "city", "emergencyContactName", "emergencyContactNumber",
      "gsisNo", "tinNo", "philHealthNo", "pagIbigNo", "imagePath", "qrPath"
    ],
    statusFilter: "active",
    idColumnSource: "bio",
    sheetName: "Gov IDs",
  },
];


const USER_TPL_KEY = "hrps.userTemplates";
const LAST_TPL_KEY = "hrps.export.template";

function loadUserTemplates(): ExportTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(USER_TPL_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveUserTemplates(list: ExportTemplate[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_TPL_KEY, JSON.stringify(list));
}

export function getAllTemplates(): ExportTemplate[] {
  // IMPORTANT: always read fresh from localStorage
  const user = loadUserTemplates();
  // avoid id collisions: keep first occurrence of an id
  const merged: ExportTemplate[] = [];
  const seen = new Set<string>();
  for (const t of [...EXPORT_TEMPLATES, ...user]) {
    if (!seen.has(t.id)) {
      seen.add(t.id);
      merged.push(t);
    }
  }
  return merged;
}

function genTemplateId(name: string) {
  // simple unique id: slug + timestamp
  const slug = name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");
  return `${slug}-${Date.now()}`;
}

export function saveTemplateToLocalStorage(
  name: string,
  tpl: Omit<ExportTemplate, "id" | "name"> & Partial<Pick<ExportTemplate, "name">>
): ExportTemplate {
  const all = loadUserTemplates();
  const id = genTemplateId(name);
  const newTpl: ExportTemplate = { id, name, ...tpl };

  // push and persist
  all.push(newTpl);
  saveUserTemplates(all);

  // remember last used template id (your effects already read this)
  if (typeof window !== "undefined") {
    localStorage.setItem(LAST_TPL_KEY, id);
  }
  return newTpl;
}

export function deleteUserTemplate(id: string) {
  const all = loadUserTemplates().filter(t => t.id !== id);
  saveUserTemplates(all);
}

export function clearAllUserTemplates() {
  saveUserTemplates([]);
}

export function clearLastUsedTemplate() {
  if (typeof window !== "undefined") localStorage.removeItem(LAST_TPL_KEY);
}
