// utils/export-templates-api.ts
import type { ExportTemplate } from "@/utils/export-templates";
import {
  getUserTemplates,
  isLocalTemplatesMigrated,
  markLocalTemplatesMigrated,
  remapTemplateUsageIds,
  setUserTemplates,
} from "@/utils/export-templates";

const META_KEYS = new Set([
  "id",
  "name",
  "description",
  "createdAt",
  "updatedAt",
  "departmentId",
  "userId",
  "config",
]);

export type CreateExportTemplateInput = {
  name: string;
  description?: string | null;
  selectedKeys: string[];
  [key: string]: unknown;
};

export type UpdateExportTemplateInput = {
  name?: string;
  description?: string | null;
  selectedKeys?: string[];
  config?: Record<string, unknown>;
  [key: string]: unknown;
};

type ExportTemplateDto = {
  id: string;
  name: string;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
  selectedKeys: string[];
  [key: string]: unknown;
};

function baseUrl(departmentId: string) {
  return `/api/${encodeURIComponent(departmentId)}/export-templates`;
}

function templateUrl(departmentId: string, templateId: string) {
  return `${baseUrl(departmentId)}/${encodeURIComponent(templateId)}`;
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return `Request failed (${res.status})`;
    try {
      const json = JSON.parse(text) as { error?: string };
      if (json?.error) return json.error;
    } catch {
      // plain text body
    }
    return text;
  } catch {
    return `Request failed (${res.status})`;
  }
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as T;
}

function dtoToExportTemplate(dto: ExportTemplateDto): ExportTemplate {
  const {
    id,
    name,
    description,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...rest
  } = dto;

  return {
    ...rest,
    id: String(id),
    name: String(name),
    ...(description == null || description === ""
      ? {}
      : { description: String(description) }),
    selectedKeys: Array.isArray(rest.selectedKeys)
      ? (rest.selectedKeys as string[])
      : Array.isArray(dto.selectedKeys)
        ? dto.selectedKeys
        : [],
  } as ExportTemplate;
}

function extractConfigFields(input: Record<string, unknown>): Record<string, unknown> {
  const config: Record<string, unknown> = {};

  if (input.config && typeof input.config === "object" && !Array.isArray(input.config)) {
    Object.assign(config, input.config as Record<string, unknown>);
  }

  for (const [key, value] of Object.entries(input)) {
    if (META_KEYS.has(key)) continue;
    if (value !== undefined) config[key] = value;
  }

  return config;
}

function toCreateBody(input: CreateExportTemplateInput) {
  const config = extractConfigFields(input as Record<string, unknown>);
  return {
    name: input.name,
    ...(input.description !== undefined ? { description: input.description } : {}),
    config,
  };
}

function toPatchBody(patch: UpdateExportTemplateInput) {
  const body: {
    name?: string;
    description?: string | null;
    config?: Record<string, unknown>;
  } = {};

  if (patch.name !== undefined) body.name = patch.name;
  if (patch.description !== undefined) body.description = patch.description;

  const config = extractConfigFields(patch as Record<string, unknown>);
  const hasExplicitConfig =
    patch.config !== undefined ||
    Object.keys(patch).some((key) => !META_KEYS.has(key) && patch[key] !== undefined);

  if (hasExplicitConfig) {
    body.config = config;
  }

  return body;
}

function isImportableTemplate(
  x: unknown
): x is { name: string; selectedKeys: string[]; description?: string | null; [key: string]: unknown } {
  if (!x || typeof x !== "object") return false;
  const item = x as Record<string, unknown>;
  return (
    typeof item.name === "string" &&
    item.name.trim().length > 0 &&
    Array.isArray(item.selectedKeys) &&
    item.selectedKeys.length > 0 &&
    item.selectedKeys.every((k) => typeof k === "string" && k.length > 0)
  );
}

export async function fetchExportTemplates(
  departmentId: string
): Promise<ExportTemplate[]> {
  const data = await apiJson<{ items: ExportTemplateDto[] }>(baseUrl(departmentId));
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map(dtoToExportTemplate);
}

export async function createExportTemplate(
  departmentId: string,
  input: CreateExportTemplateInput
): Promise<ExportTemplate> {
  const dto = await apiJson<ExportTemplateDto>(baseUrl(departmentId), {
    method: "POST",
    body: JSON.stringify(toCreateBody(input)),
  });
  return dtoToExportTemplate(dto);
}

export async function updateExportTemplate(
  departmentId: string,
  id: string,
  patch: UpdateExportTemplateInput
): Promise<ExportTemplate> {
  const dto = await apiJson<ExportTemplateDto>(templateUrl(departmentId, id), {
    method: "PATCH",
    body: JSON.stringify(toPatchBody(patch)),
  });
  return dtoToExportTemplate(dto);
}

export async function deleteExportTemplate(
  departmentId: string,
  id: string
): Promise<void> {
  await apiJson<{ ok: true }>(templateUrl(departmentId, id), {
    method: "DELETE",
  });
}

export async function clearAllExportTemplates(
  departmentId: string,
  ids: string[]
): Promise<void> {
  for (const id of ids) {
    await deleteExportTemplate(departmentId, id);
  }
}

/**
 * One-time per-department migrate from `hrps.userTemplates` → API when DB is empty.
 */
export async function migrateLocalTemplatesIfNeeded(
  departmentId: string
): Promise<{ migrated: number; skipped: boolean }> {
  if (isLocalTemplatesMigrated(departmentId)) {
    return { migrated: 0, skipped: true };
  }

  const dbItems = await fetchExportTemplates(departmentId);
  const local = getUserTemplates();

  if (local.length === 0) {
    markLocalTemplatesMigrated(departmentId);
    return { migrated: 0, skipped: true };
  }

  if (dbItems.length > 0) {
    markLocalTemplatesMigrated(departmentId);
    return { migrated: 0, skipped: true };
  }

  const idMap: Record<string, string> = {};
  let migrated = 0;

  for (const tpl of local) {
    const created = await createExportTemplate(departmentId, {
      name: tpl.name,
      description: tpl.description ?? null,
      selectedKeys: tpl.selectedKeys,
      statusFilter: tpl.statusFilter,
      appointmentFilters: tpl.appointmentFilters,
      idColumnSource: tpl.idColumnSource,
      positionReplaceRules: tpl.positionReplaceRules,
      paths: tpl.paths,
      sheetName: tpl.sheetName,
      templateVersion: tpl.templateVersion,
      officesSelection: tpl.officesSelection,
      sheetMode: tpl.sheetMode,
      sortLevels: tpl.sortLevels,
      filterGroupMode: tpl.filterGroupMode,
      headsMode: tpl.headsMode,
      __version__: tpl.__version__,
      ...(tpl.columnOrder ? { columnOrder: tpl.columnOrder } : {}),
    });
    idMap[tpl.id] = created.id;
    migrated += 1;
  }

  markLocalTemplatesMigrated(departmentId);
  setUserTemplates([]);
  remapTemplateUsageIds(idMap);

  return { migrated, skipped: false };
}

export async function importTemplatesViaApi(
  departmentId: string,
  obj: unknown
): Promise<{ added: number; skipped: number }> {
  const list: unknown[] = Array.isArray((obj as { templates?: unknown })?.templates)
    ? ((obj as { templates: unknown[] }).templates)
    : Array.isArray(obj)
      ? obj
      : [];

  let added = 0;
  let skipped = 0;

  for (const item of list) {
    if (!isImportableTemplate(item)) {
      skipped += 1;
      continue;
    }

    const {
      id: _id,
      createdAt: _c,
      updatedAt: _u,
      name,
      description,
      ...configRest
    } = item;

    await createExportTemplate(departmentId, {
      ...configRest,
      name,
      description: description ?? null,
      selectedKeys: item.selectedKeys,
      __version__:
        typeof item.__version__ === "number" ? item.__version__ : 1,
    });
    added += 1;
  }

  return { added, skipped };
}

/** Build the same JSON export blob shape as legacy LS export. */
export function templatesToExportBlob(templates: ExportTemplate[]): Blob {
  const payload = {
    __kind__: "hrps.export.templates",
    __version__: 1,
    exportedAt: new Date().toISOString(),
    includeBuiltIns: false,
    templates,
  };

  return new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
}
