import type { GenioContext } from "./context";

export type GenioResultMetadata = {
  tool: string;
  interpretedIntent: string;
  filters?: unknown;
  selectedFields?: string[];
  resultCount?: number;
  exact: boolean;
  partial: boolean;
  scopedByDepartment: true;
  generatedAt: string;
};

export type GenioToolMeta = {
  canExport?: boolean;
  viewProfileEmployeeId?: string;
  metadata?: GenioResultMetadata;
};

export function createGenioMetadata({
  tool,
  filters,
  selectedFields,
  resultCount,
  exact = true,
  partial = false,
}: {
  tool: string;
  filters?: unknown;
  selectedFields?: string[];
  resultCount?: number;
  exact?: boolean;
  partial?: boolean;
}): GenioResultMetadata {
  return {
    tool,
    interpretedIntent: tool,
    filters,
    selectedFields,
    resultCount,
    exact,
    partial,
    scopedByDepartment: true,
    generatedAt: new Date().toISOString(),
  };
}

export function attachGenioMetadata<T extends { kind: "text"; context: GenioContext; meta?: GenioToolMeta }>(
  result: T,
  metadata: GenioResultMetadata
): T {
  return {
    ...result,
    meta: {
      ...result.meta,
      metadata,
    },
  };
}
