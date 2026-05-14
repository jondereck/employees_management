import crypto from "crypto";
import { z } from "zod";

const genderSchema = z.enum(["Male", "Female"]);

const boundedString = (max = 200) => z.string().trim().min(1).max(max);

export const genioAgeFilterSchema = z
  .object({
    min: z.number().int().min(0).max(120).optional(),
    max: z.number().int().min(0).max(120).optional(),
    exact: z.number().int().min(0).max(120).optional(),
  })
  .strip();

export const genioTenureFilterSchema = z
  .object({
    min: z.number().int().min(0).max(100).optional(),
    max: z.number().int().min(0).max(100).optional(),
  })
  .strip();

export const genioFiltersSchema = z
  .object({
    query: boundedString(250).optional(),
    employeeNumbers: z.array(boundedString(30)).max(50).optional(),
    noteKeywords: z.array(boundedString(80)).max(10).optional(),
    employeeNoPrefix: boundedString(30).optional(),
    office: boundedString(200).optional(),
    officeId: z.string().trim().min(1).max(100).optional(),
    officeName: boundedString(200).optional(),
    officeIds: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
    employeeType: boundedString(120).optional(),
    employeeTypeId: z.string().trim().min(1).max(100).optional(),
    employeeTypeName: boundedString(120).optional(),
    gender: genderSchema.optional(),
    age: genioAgeFilterSchema.optional(),
    tenure: genioTenureFilterSchema.optional(),
    year: z.number().int().min(1900).max(2200).optional(),
    isHead: z.boolean().optional(),
  })
  .strip();

export const genioLastResultSchema = z
  .object({
    type: z.enum([
      "employee_lookup",
      "employee_filter",
      "note_search",
      "employee_no_prefix",
      "current_employees_by_year",
      "age_analysis",
      "tenure_analysis",
      "list_heads",
      "top_offices",
      "smallest_office",
      "compare_offices",
      "compare_employee_types",
    ]),
    filters: genioFiltersSchema.optional(),
    employeeIds: z.array(z.string().trim().min(1).max(100)).max(500).optional(),
    officeIds: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
    label: boundedString(120).optional(),
  })
  .strip();

export const genioContextSchema = z
  .object({
    lastResult: genioLastResultSchema.optional(),
    lastEmployeeId: z.string().trim().min(1).max(100).optional(),
    lastOfficeId: z.string().trim().min(1).max(100).optional(),
    lastOfficeName: boundedString(200).optional(),
  })
  .strip();

const signedGenioContextSchema = genioContextSchema
  .extend({
    signature: z.string().trim().min(1).max(256).optional(),
  })
  .strip();

export type GenioContext = z.infer<typeof genioContextSchema>;
export type SignedGenioContext = z.infer<typeof signedGenioContextSchema>;
export type GenioFilters = z.infer<typeof genioFiltersSchema>;
export type GenioLastResult = z.infer<typeof genioLastResultSchema>;

type ContextScope = {
  departmentId: string;
  userId: string;
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function contextSecret() {
  return (
    process.env.GENIO_CONTEXT_SECRET ||
    process.env.CLERK_SECRET_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.DATABASE_URL ||
    "genio-dev-context-secret"
  );
}

function signContext(context: GenioContext, scope: ContextScope) {
  const payload = stableStringify({ context, scope });
  return crypto
    .createHmac("sha256", contextSecret())
    .update(payload)
    .digest("hex");
}

function signaturesMatch(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function sealGenioContext(
  context: GenioContext | null | undefined,
  scope: ContextScope
): SignedGenioContext {
  const safeContext = genioContextSchema.parse(context ?? {});
  return {
    ...safeContext,
    signature: signContext(safeContext, scope),
  };
}

export function openGenioContext(
  value: unknown,
  scope: ContextScope
): GenioContext {
  const parsed = signedGenioContextSchema.safeParse(value);
  if (!parsed.success) return {};

  const { signature, ...context } = parsed.data;
  if (!signature) return {};

  const expected = signContext(context, scope);
  if (!signaturesMatch(signature, expected)) return {};

  return context;
}

