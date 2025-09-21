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
    __version__?: number;
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


export function getUserTemplates(): ExportTemplate[] {
  return loadUserTemplates();
}
export function setUserTemplates(list: ExportTemplate[]) {
  saveUserTemplates(list);
}

/** Very light guard so bad JSON files won't crash the app */
function isTemplateLike(x: any): x is ExportTemplate {
  return (
    x &&
    typeof x === "object" &&
    typeof x.id === "string" &&
    typeof x.name === "string" &&
    Array.isArray(x.selectedKeys)
  );
}
/**
 * Export templates to a downloadable JSON Blob.
 * - includeBuiltIns=false (default): only user templates
 * - includeBuiltIns=true: user templates + built-in EXPORT_TEMPLATES
 */
export function exportTemplatesToBlob(opts?: { includeBuiltIns?: boolean }) {
  const includeBuiltIns = !!opts?.includeBuiltIns;
  const data = includeBuiltIns ? getAllTemplates() : getUserTemplates();

  const payload = {
    __kind__: "hrps.export.templates",
    __version__: 1,
    exportedAt: new Date().toISOString(),
    includeBuiltIns,
    templates: data,
  };

  return new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
}

/**
 * Import templates from an already-parsed object (usually JSON).
 * - If an id collision is found:
 *    • overwriteOnIdConflict=true  -> overwrite existing user template with same id
 *    • overwriteOnIdConflict=false -> create a copy with a new id + " (copy)" suffix
 *
 * Returns: counts for UX toasting.
 */
export function importTemplatesFromObject(
  obj: any,
  options?: { overwriteOnIdConflict?: boolean }
): { added: number; overwritten: number; skipped: number } {
  const overwrite = !!options?.overwriteOnIdConflict;

  // Accept either a payload { templates: [...] } or a raw array [...]
  const list: any[] = Array.isArray(obj?.templates)
    ? obj.templates
    : Array.isArray(obj)
    ? obj
    : [];

  if (!Array.isArray(list)) return { added: 0, overwritten: 0, skipped: 0 };

  const user = getUserTemplates();
  const byId = new Map(user.map((t) => [t.id, t]));

  let added = 0;
  let overwritten = 0;
  let skipped = 0;

  for (const item of list) {
    if (!isTemplateLike(item)) {
      skipped++;
      continue;
    }

    // Ensure our internal version field is present for future migrations
    item.__version__ = 1;

    if (byId.has(item.id)) {
      if (overwrite) {
        byId.set(item.id, item);
        overwritten++;
      } else {
        // generate a unique id based on your existing genTemplateId scheme
        const copyId = genTemplateId(item.name || "template");
        byId.set(copyId, { ...item, id: copyId, name: `${item.name} (copy)` });
        added++;
      }
    } else {
      byId.set(item.id, item);
      added++;
    }
  }

  const merged = Array.from(byId.values());
  setUserTemplates(merged);

  // If last-used template points to something that no longer exists, clear it
  if (typeof window !== "undefined") {
    const last = localStorage.getItem(LAST_TPL_KEY);
    if (last && !merged.find((t) => t.id === last)) {
      localStorage.removeItem(LAST_TPL_KEY);
    }
  }

  return { added, overwritten, skipped };
}