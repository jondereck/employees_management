import type { EmployeeExportTemplate, Prisma } from "@prisma/client";
import { z } from "zod";

export const exportTemplateConfigSchema = z
  .object({
    selectedKeys: z.array(z.string().min(1)).min(1).max(200),
    statusFilter: z.enum(["all", "active", "retired"]).optional(),
    appointmentFilters: z.union([z.array(z.string()), z.literal("all")]).optional(),
    idColumnSource: z.string().optional(),
    positionReplaceRules: z.array(z.unknown()).optional(),
    paths: z.record(z.unknown()).optional(),
    sheetName: z.string().optional(),
    templateVersion: z.number().optional(),
    officesSelection: z.array(z.string()).optional(),
    sheetMode: z.enum(["perOffice", "merged", "plain"]).optional(),
    sortLevels: z.array(z.unknown()).optional(),
    filterGroupMode: z.enum(["office", "bioIndex"]).optional(),
    headsMode: z.unknown().optional(),
    __version__: z.number().optional(),
  })
  .passthrough();

export type ExportTemplateConfig = z.infer<typeof exportTemplateConfigSchema>;

export const createExportTemplateBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  config: exportTemplateConfigSchema,
});

export const patchExportTemplateBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).optional().nullable(),
    config: exportTemplateConfigSchema.optional(),
  })
  .refine((v) => v.name !== undefined || v.description !== undefined || v.config !== undefined, {
    message: "At least one of name, description, config is required",
  });

const OWNERSHIP_KEYS = [
  "id",
  "departmentId",
  "userId",
  "name",
  "description",
  "createdAt",
  "updatedAt",
  "config",
] as const;

export type ExportTemplateDto = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  selectedKeys: string[];
  [key: string]: unknown;
};

export function stripOwnershipFields(
  config: Record<string, unknown>
): Record<string, unknown> {
  const cleaned: Record<string, unknown> = { ...config };
  for (const key of OWNERSHIP_KEYS) {
    delete cleaned[key];
  }
  return cleaned;
}

export function configToJson(config: ExportTemplateConfig): Prisma.InputJsonValue {
  return stripOwnershipFields(config as Record<string, unknown>) as Prisma.InputJsonValue;
}

export function toExportTemplateDto(row: EmployeeExportTemplate): ExportTemplateDto {
  const raw =
    row.config && typeof row.config === "object" && !Array.isArray(row.config)
      ? (row.config as Record<string, unknown>)
      : {};
  const config = stripOwnershipFields(raw);

  return {
    ...config,
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    selectedKeys: Array.isArray(config.selectedKeys)
      ? (config.selectedKeys as string[])
      : [],
  };
}
