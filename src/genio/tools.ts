import * as XLSX from "xlsx";
import { EmploymentEventType, Gender, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { resolveEmployeeType } from "./resolve-employee-type";
import { resolveOfficeWithAliases } from "./resolve-office";
import { suggestOffices } from "./suggest-office";
import {
  GenioContext,
  GenioFilters,
  GenioLastResult,
  genioAgeFilterSchema,
  genioFiltersSchema,
  genioTenureFilterSchema,
} from "./context";
import { z } from "zod";
import { GenioToolMeta } from "./formatter";
import { genioToolArgumentSchemas } from "./validators";
import { notAnswerableMessage } from "./errors";
import { computeTenure } from "@/utils/tenure";

type GenioToolName =
  | "lookup_employees"
  | "employee_extreme"
  | "count_employees"
  | "office_distribution"
  | "list_offices"
  | "list_office_heads"
  | "who_is_office_head"
  | "check_office_head"
  | "offices_without_head"
  | "gender_distribution"
  | "age_distribution"
  | "office_insight"
  | "compare_offices"
  | "compare_employee_types"
  | "top_offices"
  | "smallest_office"
  | "age_analysis"
  | "tenure_analysis"
  | "current_employees_by_year"
  | "list_last_result"
  | "show_profile"
  | "export_last_result"
  | "history_snapshot"
  | "award_analytics"
  | "employment_event_lookup"
  | "schedule_metadata"
  | "not_answerable";

type ToolMeta = GenioToolMeta;

export type GenioTextResult = {
  kind: "text";
  reply: string;
  context: GenioContext;
  meta?: ToolMeta;
};

export type GenioFileResult = {
  kind: "file";
  response: Response;
};

export type GenioToolResult = GenioTextResult | GenioFileResult;

export type ToolEnvironment = {
  departmentId: string;
  message: string;
  context: GenioContext;
};

const stringArraySchema = z.array(z.string().trim().min(1).max(200)).max(20);

const lookupEmployeesSchema = z
  .object({
    query: z.string().trim().min(1).max(250).optional(),
    employeeNumbers: stringArraySchema.optional(),
    employeeNoPrefix: z.string().trim().min(1).max(30).optional(),
    noteKeywords: stringArraySchema.max(10).optional(),
  })
  .strip();

const employeeExtremeSchema = z
  .object({
    metric: z.enum(["oldest", "youngest", "longest_tenure", "newest_hire"]),
  })
  .strip();

const countEmployeesSchema = z
  .object({
    office: z.string().trim().min(1).max(200).optional(),
    gender: z.enum(["Male", "Female"]).optional(),
    employeeType: z.string().trim().min(1).max(120).optional(),
  })
  .strip();

const officeDistributionSchema = z
  .object({
    gender: z.enum(["Male", "Female"]).optional(),
    employeeType: z.string().trim().min(1).max(120).optional(),
    age: genioAgeFilterSchema.optional(),
  })
  .strip();

const officeQuerySchema = z
  .object({
    office: z.string().trim().min(1).max(200).optional(),
  })
  .strip();

const checkOfficeHeadSchema = z
  .object({
    employeeName: z.string().trim().min(1).max(200),
    office: z.string().trim().min(1).max(200),
  })
  .strip();

const compareOfficesSchema = z
  .object({
    offices: stringArraySchema.min(2).max(4).optional(),
  })
  .strip();

const ageAnalysisSchema = z
  .object({
    age: genioAgeFilterSchema,
    gender: z.enum(["Male", "Female"]).optional(),
    office: z.string().trim().min(1).max(200).optional(),
  })
  .strip();

const tenureAnalysisSchema = z
  .object({
    tenure: genioTenureFilterSchema,
    gender: z.enum(["Male", "Female"]).optional(),
    office: z.string().trim().min(1).max(200).optional(),
  })
  .strip();

const yearSchema = z
  .object({
    year: z.number().int().min(1900).max(2200).optional(),
  })
  .strip();

const emptySchema = z.object({}).strip();

export const GENIO_OPENAI_TOOLS = [
  {
    type: "function",
    function: {
      name: "lookup_employees",
      description:
        "Find employees by name, nickname, employee number, BIO prefix, or note keywords. Use for who/sino/name/profile lookup questions.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          employeeNumbers: { type: "array", items: { type: "string" } },
          employeeNoPrefix: { type: "string" },
          noteKeywords: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "employee_extreme",
      description:
        "Find one active employee by a database extreme: oldest, youngest, longest tenure/service, or newest hire. Use for questions like who is the oldest employee or pinakamatanda.",
      parameters: {
        type: "object",
        properties: {
          metric: {
            type: "string",
            enum: ["oldest", "youngest", "longest_tenure", "newest_hire"],
          },
        },
        required: ["metric"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "count_employees",
      description:
        "Count active employees. Supports office, gender, and employee type filters. Use for ilan/how many/total questions.",
      parameters: {
        type: "object",
        properties: {
          office: { type: "string" },
          gender: { type: "string", enum: ["Male", "Female"] },
          employeeType: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "office_distribution",
      description:
        "Group matching active employees by office. Use when the user asks for distribution by office, per office, office breakdown, or how many by office. Supports age, gender, and employee type filters.",
      parameters: {
        type: "object",
        properties: {
          gender: { type: "string", enum: ["Male", "Female"] },
          employeeType: { type: "string" },
          age: {
            type: "object",
            properties: {
              min: { type: "number" },
              max: { type: "number" },
              exact: { type: "number" },
            },
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_offices",
      description: "List all offices in the current department.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "list_office_heads",
      description: "List active office heads or department heads.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "who_is_office_head",
      description: "Answer who is the head of a specific office.",
      parameters: {
        type: "object",
        properties: { office: { type: "string" } },
        required: ["office"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_office_head",
      description: "Check if a named employee is the head of a specific office.",
      parameters: {
        type: "object",
        properties: {
          employeeName: { type: "string" },
          office: { type: "string" },
        },
        required: ["employeeName", "office"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "offices_without_head",
      description: "List offices that do not have an active assigned head.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "age_distribution",
      description: "Show age distribution and percentiles for active employees.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "gender_distribution",
      description: "Show male/female distribution, optionally for one office.",
      parameters: {
        type: "object",
        properties: { office: { type: "string" } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "office_insight",
      description: "Give staffing insight for a specific office.",
      parameters: {
        type: "object",
        properties: { office: { type: "string" } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_offices",
      description: "Compare active employee totals and gender counts for two offices.",
      parameters: {
        type: "object",
        properties: { offices: { type: "array", items: { type: "string" } } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_employee_types",
      description: "Compare employee type breakdowns for two offices.",
      parameters: {
        type: "object",
        properties: { offices: { type: "array", items: { type: "string" } } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "top_offices",
      description: "Show the largest offices by active employee count.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "smallest_office",
      description: "Show the office with the fewest active employees.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "age_analysis",
      description:
        "Count active employees by age. Supports exact, min/above, max/below, and range.",
      parameters: {
        type: "object",
        properties: {
          age: {
            type: "object",
            properties: {
              min: { type: "number" },
              max: { type: "number" },
              exact: { type: "number" },
            },
            additionalProperties: false,
          },
          gender: { type: "string", enum: ["Male", "Female"] },
          office: { type: "string" },
        },
        required: ["age"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "tenure_analysis",
      description: "Count active employees by years of service or tenure.",
      parameters: {
        type: "object",
        properties: {
          tenure: {
            type: "object",
            properties: {
              min: { type: "number" },
              max: { type: "number" },
            },
            additionalProperties: false,
          },
          gender: { type: "string", enum: ["Male", "Female"] },
          office: { type: "string" },
        },
        required: ["tenure"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "current_employees_by_year",
      description: "Count employees who were current/active as of a specific year.",
      parameters: {
        type: "object",
        properties: { year: { type: "number" } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_last_result",
      description: "List the employees from the last count/filter result.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
] as const;

function textResult(
  reply: string,
  context: GenioContext,
  meta?: ToolMeta
): GenioTextResult {
  return { kind: "text", reply, context, meta };
}

function escapeMarkdown(text: string) {
  return text.replace(/[*_`~]/g, "");
}

function employeeName(employee: { firstName?: string | null; middleName?: string | null; lastName?: string | null }) {
  return [employee.firstName, employee.middleName, employee.lastName]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseJsonObject(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  return {};
}

function calculateAge(birthday: Date) {
  const today = new Date();
  let age = today.getFullYear() - birthday.getFullYear();
  const monthDelta = today.getMonth() - birthday.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthday.getDate())) {
    age--;
  }
  return age;
}

function dateYearsAgo(years: number) {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  return date;
}

function startOfYear(year: number) {
  return new Date(year, 0, 1);
}

function endOfYear(year: number) {
  return new Date(year, 11, 31, 23, 59, 59, 999);
}

function parseUSDate(value?: string | null): Date | null {
  if (!value) return null;

  const [month, day, year] = value.split("/").map(Number);
  if (!month || !day || !year) return null;

  return new Date(year, month - 1, day);
}

function genderToPrisma(gender?: "Male" | "Female") {
  if (!gender) return undefined;
  return gender === "Male" ? Gender.Male : Gender.Female;
}

async function departmentOffices(departmentId: string) {
  return prisma.offices.findMany({
    where: { departmentId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

async function departmentEmployeeTypes(departmentId: string) {
  return prisma.employeeType.findMany({
    where: { departmentId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

async function resolveOffice(
  departmentId: string,
  input?: string,
  fallbackMessage?: string
) {
  const offices = await departmentOffices(departmentId);
  const query = input || fallbackMessage || "";
  if (!query.trim()) return { office: null, offices };
  return { office: resolveOfficeWithAliases(query, offices), offices };
}

async function resolveOfficeOrReply(
  departmentId: string,
  input: string | undefined,
  fallbackMessage: string,
  context: GenioContext
) {
  const { office, offices } = await resolveOffice(departmentId, input, fallbackMessage);
  if (office) return { office, result: null };

  const suggestions = suggestOffices(input || fallbackMessage, offices);
  if (suggestions.length > 0) {
    return {
      office: null,
      result: textResult(
        `Which office did you mean?\n\n${suggestions.map((o) => `- ${o.name}`).join("\n")}`,
        context
      ),
    };
  }

  return {
    office: null,
    result: textResult("I could not identify the office. Please include the office name.", context),
  };
}

async function resolveManyOffices(
  departmentId: string,
  names: string[] | undefined,
  message: string
) {
  const offices = await departmentOffices(departmentId);
  const resolved: { id: string; name: string }[] = [];
  const candidates = [...(names ?? []), message];

  for (const candidate of candidates) {
    for (const office of offices) {
      if (resolved.some((item) => item.id === office.id)) continue;
      const match = resolveOfficeWithAliases(candidate, [office]);
      if (match) resolved.push(match);
    }
  }

  return resolved;
}

async function buildEmployeeWhere(
  departmentId: string,
  filters: GenioFilters | undefined
): Promise<Prisma.EmployeeWhereInput> {
  const where: Prisma.EmployeeWhereInput = {
    departmentId,
    isArchived: false,
  };

  if (!filters) return where;

  if (filters.officeId) {
    where.officeId = filters.officeId;
  } else if (filters.officeIds?.length) {
    where.officeId = { in: filters.officeIds };
  }

  const gender = genderToPrisma(filters.gender);
  if (gender) where.gender = gender;

  if (filters.employeeTypeId) {
    where.employeeTypeId = filters.employeeTypeId;
  }

  if (filters.isHead !== undefined) {
    where.isHead = filters.isHead;
  }

  if (filters.age) {
    const today = new Date();
    const birthday: Prisma.DateTimeFilter = {};

    if (typeof filters.age.exact === "number") {
      const maxBirthDate = new Date(today);
      maxBirthDate.setFullYear(today.getFullYear() - filters.age.exact);

      const minBirthDate = new Date(today);
      minBirthDate.setFullYear(today.getFullYear() - filters.age.exact - 1);

      birthday.lte = maxBirthDate;
      birthday.gt = minBirthDate;
    } else {
      if (typeof filters.age.min === "number") {
        birthday.lte = dateYearsAgo(filters.age.min);
      }
      if (typeof filters.age.max === "number") {
        birthday.gte = dateYearsAgo(filters.age.max);
      }
    }

    if (Object.keys(birthday).length > 0) {
      where.birthday = birthday;
    }
  }

  return where;
}

async function resolveEmployeeFilter(
  departmentId: string,
  filters: GenioFilters,
  message: string
) {
  const nextFilters = { ...filters };

  if (nextFilters.office && !nextFilters.officeId) {
    const { office } = await resolveOffice(departmentId, nextFilters.office, message);
    if (office) {
      nextFilters.officeId = office.id;
      nextFilters.officeName = office.name;
    }
  }

  if (nextFilters.employeeType && !nextFilters.employeeTypeId) {
    const employeeTypes = await departmentEmployeeTypes(departmentId);
    const employeeType = resolveEmployeeType(nextFilters.employeeType, employeeTypes);
    if (employeeType) {
      nextFilters.employeeTypeId = employeeType.id;
      nextFilters.employeeTypeName = employeeType.name;
    }
  }

  return nextFilters;
}

function formatEmployeeList(
  employees: Array<{
    employeeNo?: string | null;
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
    offices?: { name: string } | null;
  }>,
  limit = 50
) {
  const rows = employees.slice(0, limit).map((employee, index) => {
    const office = employee.offices?.name ?? "No office";
    const number = employee.employeeNo ? `${employee.employeeNo} - ` : "";
    return `${index + 1}. ${number}${employeeName(employee)} (${office})`;
  });

  if (employees.length > limit) {
    rows.push(`...and ${employees.length - limit} more.`);
  }

  return rows.join("\n");
}

async function employeesForLastResult(
  departmentId: string,
  lastResult: GenioLastResult,
  limit?: number
) {
  if (lastResult.type === "current_employees_by_year") {
    const year = lastResult.filters?.year ?? new Date().getFullYear();
    const yearEnd = endOfYear(year);
    const rows = await prisma.employee.findMany({
      where: {
        departmentId,
        dateHired: { lte: yearEnd },
      },
      include: {
        offices: { select: { name: true } },
        employeeType: { select: { name: true } },
      },
      orderBy: { lastName: "asc" },
      take: limit,
    });

    return rows.filter((employee) => {
      const termination = parseUSDate(employee.terminateDate);
      return !termination || termination > yearEnd;
    });
  }

  const where = await buildEmployeeWhere(departmentId, lastResult.filters);

  if (lastResult.employeeIds?.length) {
    where.id = { in: lastResult.employeeIds };
  }

  if (lastResult.officeIds?.length) {
    where.officeId = { in: lastResult.officeIds };
  }

  return prisma.employee.findMany({
    where,
    include: {
      offices: { select: { name: true } },
      employeeType: { select: { name: true } },
    },
    orderBy: { lastName: "asc" },
    take: limit,
  });
}

async function lookupEmployees(env: ToolEnvironment, args: unknown): Promise<GenioTextResult> {
  const parsed = lookupEmployeesSchema.safeParse(parseJsonObject(args));
  const input = parsed.success ? parsed.data : {};
  const query = input.query || env.message;

  if (input.noteKeywords?.length) {
    const employees = await prisma.employee.findMany({
      where: {
        departmentId: env.departmentId,
        isArchived: false,
        OR: input.noteKeywords.map((keyword) => ({
          note: { contains: keyword, mode: "insensitive" },
        })),
      },
      include: { offices: true, employeeType: true },
      orderBy: { lastName: "asc" },
    });

    if (!employees.length) {
      return textResult(
        `No employees found with notes containing ${input.noteKeywords.join(", ")}.`,
        env.context
      );
    }

    const context: GenioContext = {
      ...env.context,
      lastResult: {
        type: "note_search",
        employeeIds: employees.map((employee) => employee.id),
        filters: { noteKeywords: input.noteKeywords },
      },
    };

    return textResult(
      `Here are employees with matching notes:\n\n${formatEmployeeList(employees)}`,
      context,
      { canExport: true }
    );
  }

  if (input.employeeNoPrefix) {
    const employees = await prisma.employee.findMany({
      where: {
        departmentId: env.departmentId,
        isArchived: false,
        employeeNo: { startsWith: input.employeeNoPrefix, mode: "insensitive" },
      },
      include: { offices: true, employeeType: true },
      orderBy: { lastName: "asc" },
    });

    if (!employees.length) {
      return textResult(
        `No employees found with employee numbers starting with ${input.employeeNoPrefix}.`,
        env.context
      );
    }

    return textResult(
      `Here are employees with employee numbers starting with ${input.employeeNoPrefix}:\n\n${formatEmployeeList(employees)}`,
      {
        ...env.context,
        lastResult: {
          type: "employee_no_prefix",
          employeeIds: employees.map((employee) => employee.id),
          filters: { employeeNoPrefix: input.employeeNoPrefix },
        },
      },
      { canExport: true }
    );
  }

  const employeeNumbers = [
    ...new Set(
      [
        ...(input.employeeNumbers ?? []),
        ...(query.match(/\b[A-Za-z0-9-]{2,30}\b/g) ?? []),
      ]
        .map((value) => value.replace(/[.,]/g, "").trim())
        .filter((value) => /\d/.test(value))
    ),
  ];

  if (employeeNumbers.length > 0) {
    const employees = await prisma.employee.findMany({
      where: {
        departmentId: env.departmentId,
        isArchived: false,
        OR: employeeNumbers.map((number) => ({
          employeeNo: { contains: number, mode: "insensitive" },
        })),
      },
      include: { offices: true, employeeType: true },
      orderBy: { lastName: "asc" },
    });

    if (!employees.length) {
      return textResult("I could not find employees with the provided employee number.", env.context);
    }

    const context: GenioContext = {
      ...env.context,
      lastResult: {
        type: "employee_lookup",
        employeeIds: employees.map((employee) => employee.id),
        filters: { employeeNumbers },
      },
    };

    if (employees.length === 1) {
      const employee = employees[0];
      const note = employee.note ? `\n\nNote: ${employee.note}` : "";
      return textResult(
        `${employeeName(employee)} (${employee.employeeNo}) is a ${employee.position} in ${employee.offices?.name}.${note}`,
        {
          ...context,
          lastEmployeeId: employee.id,
          lastOfficeId: employee.officeId,
          lastOfficeName: employee.offices?.name,
        },
        { viewProfileEmployeeId: employee.id, canExport: true }
      );
    }

    return textResult(
      `Here are the employees I found:\n\n${formatEmployeeList(employees)}`,
      context,
      { canExport: true }
    );
  }

  const cleaned = query
    .toLowerCase()
    .replace(/who is|who are|tell me about|sino si|sino sina|impormasyon ni|profile ni|show profile/gi, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return textResult("Please provide an employee name, nickname, employee number, BIO prefix, or note keyword.", env.context);
  }

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const employees = await prisma.employee.findMany({
    where: {
      departmentId: env.departmentId,
      isArchived: false,
      AND: tokens.map((token) => ({
        OR: [
          { firstName: { contains: token, mode: "insensitive" } },
          { middleName: { contains: token, mode: "insensitive" } },
          { lastName: { contains: token, mode: "insensitive" } },
          { nickname: { contains: token, mode: "insensitive" } },
          { employeeNo: { contains: token, mode: "insensitive" } },
        ],
      })),
    },
    include: { offices: true, employeeType: true },
    orderBy: { lastName: "asc" },
    take: 25,
  });

  if (!employees.length) {
    return textResult(`I could not find an active employee matching "${cleaned}".`, env.context);
  }

  const context: GenioContext = {
    ...env.context,
    lastResult: {
      type: "employee_lookup",
      employeeIds: employees.map((employee) => employee.id),
      filters: { query: cleaned },
    },
  };

  if (employees.length === 1) {
    const employee = employees[0];
    const note = employee.note ? `\n\nNote: ${employee.note}` : "";
    return textResult(
      `${employeeName(employee)} is a ${employee.position} in ${employee.offices?.name}.${note}`,
      {
        ...context,
        lastEmployeeId: employee.id,
        lastOfficeId: employee.officeId,
        lastOfficeName: employee.offices?.name,
      },
      { viewProfileEmployeeId: employee.id }
    );
  }

  return textResult(
    `I found multiple employees. Please choose who you mean:\n\n${formatEmployeeList(employees, 10)}`,
    context,
    { canExport: true }
  );
}

async function employeeExtreme(env: ToolEnvironment, args: unknown): Promise<GenioTextResult> {
  const parsed = employeeExtremeSchema.safeParse(parseJsonObject(args));
  if (!parsed.success) {
    return textResult(
      "Please ask for oldest, youngest, longest service, or newest hire.",
      env.context
    );
  }

  const { metric } = parsed.data;
  const orderBy =
    metric === "oldest"
      ? { birthday: "asc" as const }
      : metric === "youngest"
      ? { birthday: "desc" as const }
      : metric === "longest_tenure"
      ? { dateHired: "asc" as const }
      : { dateHired: "desc" as const };

  const employee = await prisma.employee.findFirst({
    where: {
      departmentId: env.departmentId,
      isArchived: false,
    },
    include: {
      offices: true,
      employeeType: true,
    },
    orderBy,
  });

  if (!employee) {
    return textResult("I could not find any active employees in this department.", env.context);
  }

  const label =
    metric === "oldest"
      ? "oldest active employee"
      : metric === "youngest"
      ? "youngest active employee"
      : metric === "longest_tenure"
      ? "active employee with the longest service"
      : "newest active hire";

  const detail =
    metric === "oldest" || metric === "youngest"
      ? `Age: ${calculateAge(employee.birthday)}`
      : `Years of service: ${calculateAge(employee.dateHired)}`;

  return textResult(
    `The ${label} is ${employeeName(employee)} (${employee.employeeNo}) from ${employee.offices?.name}.\n\n${detail}\nPosition: ${employee.position}`,
    {
      ...env.context,
      lastEmployeeId: employee.id,
      lastOfficeId: employee.officeId,
      lastOfficeName: employee.offices?.name,
      lastResult: {
        type: "employee_lookup",
        employeeIds: [employee.id],
        filters: { query: metric },
      },
    },
    { viewProfileEmployeeId: employee.id, canExport: true }
  );
}

async function countEmployees(env: ToolEnvironment, args: unknown): Promise<GenioTextResult> {
  const parsed = countEmployeesSchema.safeParse(parseJsonObject(args));
  const input = parsed.success ? parsed.data : {};

  let filters = genioFiltersSchema.parse({
    gender: input.gender,
    office: input.office,
    employeeType: input.employeeType,
  });
  filters = await resolveEmployeeFilter(env.departmentId, filters, env.message);

  const mentionsOffice = /office|department|division|unit|\bin\s+|\bsa\s+/i.test(env.message);
  if (!filters.officeId && !input.office && mentionsOffice) {
    const resolved = await resolveOfficeOrReply(env.departmentId, undefined, env.message, env.context);
    if (resolved.result) return resolved.result;
    filters.officeId = resolved.office?.id;
    filters.officeName = resolved.office?.name;
  }

  if (input.office && !filters.officeId) {
    const resolved = await resolveOfficeOrReply(env.departmentId, input.office, env.message, env.context);
    if (resolved.result) return resolved.result;
  }

  const where = await buildEmployeeWhere(env.departmentId, filters);

  const [total, male, female] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.count({ where: { ...where, gender: Gender.Male } }),
    prisma.employee.count({ where: { ...where, gender: Gender.Female } }),
  ]);

  const filterLabel = [
    filters.gender?.toLowerCase(),
    filters.employeeTypeName,
    filters.officeName ? `in ${filters.officeName}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const reply = filters.gender
    ? `There are ${total} ${filterLabel || "matching"} employees.`
    : `There are ${total} active employees${filters.officeName ? ` in ${filters.officeName}` : ""}.\n\n- Male: ${male}\n- Female: ${female}`;

  return textResult(
    reply,
    {
      ...env.context,
      lastResult: {
        type: "employee_filter",
        filters,
      },
      lastOfficeId: filters.officeId ?? env.context.lastOfficeId,
      lastOfficeName: filters.officeName ?? env.context.lastOfficeName,
    },
    { canExport: true }
  );
}

function ageLabel(age?: GenioFilters["age"]) {
  if (!age) return null;
  if (typeof age.exact === "number") return `${age.exact} years old`;
  if (typeof age.min === "number" && typeof age.max === "number") {
    return `between ${age.min} and ${age.max}`;
  }
  if (typeof age.min === "number") return `${age.min} and above`;
  if (typeof age.max === "number") return `${age.max} and below`;
  return null;
}

async function officeDistribution(env: ToolEnvironment, args: unknown): Promise<GenioTextResult> {
  const parsed = officeDistributionSchema.safeParse(parseJsonObject(args));
  const input = parsed.success ? parsed.data : {};

  let filters = genioFiltersSchema.parse({
    gender: input.gender,
    employeeType: input.employeeType,
    age: input.age,
  });
  filters = await resolveEmployeeFilter(env.departmentId, filters, env.message);

  const where = await buildEmployeeWhere(env.departmentId, filters);
  const rows = await prisma.employee.groupBy({
    by: ["officeId"],
    where,
    _count: { _all: true },
  });

  const offices = await prisma.offices.findMany({
    where: {
      departmentId: env.departmentId,
      id: { in: rows.map((row) => row.officeId) },
    },
    select: { id: true, name: true },
  });
  const officeNameById = new Map(offices.map((office) => [office.id, office.name]));

  const total = rows.reduce((sum, row) => sum + row._count._all, 0);
  if (total === 0) {
    return textResult("No active employees matched that office distribution query.", env.context);
  }

  const criteria = [
    filters.gender?.toLowerCase(),
    filters.employeeTypeName,
    ageLabel(filters.age) ? `aged ${ageLabel(filters.age)}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const lines = rows
    .map((row) => ({
      officeName: officeNameById.get(row.officeId) ?? "Unknown office",
      count: row._count._all,
    }))
    .sort((a, b) => b.count - a.count || a.officeName.localeCompare(b.officeName))
    .map((row, index) => `${index + 1}. ${row.officeName}: ${row.count}`);

  return textResult(
    `There are ${total} active employees${criteria ? ` (${criteria})` : ""}.\n\nDistribution by office:\n${lines.join("\n")}`,
    {
      ...env.context,
      lastResult: {
        type: "employee_filter",
        filters,
      },
    },
    { canExport: true }
  );
}

async function listOffices(env: ToolEnvironment): Promise<GenioTextResult> {
  const offices = await departmentOffices(env.departmentId);
  if (!offices.length) return textResult("No offices found.", env.context);

  return textResult(
    `Here are the available offices:\n\n${offices.map((office, index) => `${index + 1}. ${office.name}`).join("\n")}`,
    env.context
  );
}

async function listOfficeHeads(env: ToolEnvironment): Promise<GenioTextResult> {
  const heads = await prisma.employee.findMany({
    where: {
      departmentId: env.departmentId,
      isArchived: false,
      isHead: true,
    },
    include: { offices: true },
    orderBy: [{ offices: { name: "asc" } }, { lastName: "asc" }],
  });

  if (!heads.length) {
    return textResult("No office heads are currently assigned.", env.context);
  }

  return textResult(
    `Here are the current office heads:\n\n${heads
      .map((employee) => `- ${employee.offices?.name ?? "No office"} - ${employeeName(employee)}`)
      .join("\n")}`,
    {
      ...env.context,
      lastResult: {
        type: "list_heads",
        employeeIds: heads.map((employee) => employee.id),
        filters: { isHead: true },
      },
    },
    { canExport: true }
  );
}

async function whoIsOfficeHead(env: ToolEnvironment, args: unknown): Promise<GenioTextResult> {
  const parsed = officeQuerySchema.safeParse(parseJsonObject(args));
  const input = parsed.success ? parsed.data : {};
  const resolved = await resolveOfficeOrReply(env.departmentId, input.office, env.message, env.context);
  if (resolved.result) return resolved.result;
  const office = resolved.office!;

  const heads = await prisma.employee.findMany({
    where: {
      departmentId: env.departmentId,
      officeId: office.id,
      isArchived: false,
      isHead: true,
    },
    include: { offices: true },
    orderBy: { lastName: "asc" },
  });

  if (!heads.length) {
    return textResult(`There is currently no head assigned for ${office.name}.`, env.context);
  }

  if (heads.length > 1) {
    return textResult(
      `I found multiple heads for ${office.name}. Please check the data:\n\n${heads
        .map((employee) => `- ${employeeName(employee)}`)
        .join("\n")}`,
      env.context
    );
  }

  const head = heads[0];
  return textResult(
    `The head of ${office.name} is ${employeeName(head)}.`,
    {
      ...env.context,
      lastEmployeeId: head.id,
      lastOfficeId: office.id,
      lastOfficeName: office.name,
    },
    { viewProfileEmployeeId: head.id }
  );
}

async function checkOfficeHead(env: ToolEnvironment, args: unknown): Promise<GenioTextResult> {
  const parsed = checkOfficeHeadSchema.safeParse(parseJsonObject(args));
  if (!parsed.success) {
    return textResult("Please ask in the format: Is [name] the head of [office]?", env.context);
  }

  const { employeeName: rawName, office: officeName } = parsed.data;
  const resolved = await resolveOfficeOrReply(env.departmentId, officeName, env.message, env.context);
  if (resolved.result) return resolved.result;
  const office = resolved.office!;
  const tokens = rawName.toLowerCase().split(/\s+/).filter(Boolean);

  const employees = await prisma.employee.findMany({
    where: {
      departmentId: env.departmentId,
      officeId: office.id,
      isArchived: false,
      OR: tokens.flatMap((token) => [
        { firstName: { contains: token, mode: "insensitive" } },
        { middleName: { contains: token, mode: "insensitive" } },
        { lastName: { contains: token, mode: "insensitive" } },
        { nickname: { contains: token, mode: "insensitive" } },
      ]),
    },
    include: { offices: true },
  });

  if (!employees.length) {
    return textResult(`I could not find "${rawName}" in ${office.name}.`, env.context);
  }

  if (employees.length > 1) {
    return textResult(
      `I found multiple matches. Who do you mean?\n\n${employees
        .map((employee) => `- ${employeeName(employee)}`)
        .join("\n")}`,
      env.context
    );
  }

  const employee = employees[0];
  const answer = employee.isHead
    ? `Yes. ${employeeName(employee)} is the head of ${office.name}.`
    : `No. ${employeeName(employee)} is not the head of ${office.name}.`;

  return textResult(
    answer,
    {
      ...env.context,
      lastEmployeeId: employee.id,
      lastOfficeId: office.id,
      lastOfficeName: office.name,
    },
    { viewProfileEmployeeId: employee.id }
  );
}

async function officesWithoutHead(env: ToolEnvironment): Promise<GenioTextResult> {
  const offices = await prisma.offices.findMany({
    where: { departmentId: env.departmentId },
    include: {
      employee: {
        where: {
          departmentId: env.departmentId,
          isHead: true,
          isArchived: false,
        },
        select: { id: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const noHead = offices.filter((office) => office.employee.length === 0);
  if (!noHead.length) {
    return textResult("All offices currently have a designated head.", env.context);
  }

  return textResult(
    `These offices do not have a head assigned:\n\n${noHead
      .map((office, index) => `${index + 1}. ${office.name}`)
      .join("\n")}`,
    env.context
  );
}

async function genderDistribution(env: ToolEnvironment, args: unknown): Promise<GenioTextResult> {
  const parsed = officeQuerySchema.safeParse(parseJsonObject(args));
  const input = parsed.success ? parsed.data : {};
  const filters: GenioFilters = {};

  const mentionsOffice = /office|department|division|unit|\bin\s+|\bsa\s+/i.test(env.message);
  if (input.office || mentionsOffice) {
    const resolved = await resolveOfficeOrReply(env.departmentId, input.office, env.message, env.context);
    if (resolved.result) return resolved.result;
    filters.officeId = resolved.office?.id;
    filters.officeName = resolved.office?.name;
  }

  const where = await buildEmployeeWhere(env.departmentId, filters);
  const [male, female] = await Promise.all([
    prisma.employee.count({ where: { ...where, gender: Gender.Male } }),
    prisma.employee.count({ where: { ...where, gender: Gender.Female } }),
  ]);

  return textResult(
    `Gender distribution${filters.officeName ? ` in ${filters.officeName}` : ""}:\n\n- Male: ${male}\n- Female: ${female}\n- Total: ${male + female}`,
    {
      ...env.context,
      lastResult: {
        type: "employee_filter",
        filters,
      },
      lastOfficeId: filters.officeId ?? env.context.lastOfficeId,
      lastOfficeName: filters.officeName ?? env.context.lastOfficeName,
    },
    { canExport: true }
  );
}

async function ageDistribution(env: ToolEnvironment): Promise<GenioTextResult> {
  const employees = await prisma.employee.findMany({
    where: {
      departmentId: env.departmentId,
      isArchived: false,
    },
    select: { birthday: true },
  });

  const ages = employees
    .filter((employee) => employee.birthday)
    .map((employee) => calculateAge(employee.birthday))
    .sort((a, b) => a - b);

  if (!ages.length) {
    return textResult("No age data available.", env.context);
  }

  const percentile = (p: number) => ages[Math.min(ages.length - 1, Math.floor((p / 100) * ages.length))];
  const distribution: Record<string, number> = {
    "Below 20": ages.filter((age) => age < 20).length,
    "20-29": ages.filter((age) => age >= 20 && age <= 29).length,
    "30-39": ages.filter((age) => age >= 30 && age <= 39).length,
    "40-49": ages.filter((age) => age >= 40 && age <= 49).length,
    "50-59": ages.filter((age) => age >= 50 && age <= 59).length,
    "60-69": ages.filter((age) => age >= 60 && age <= 69).length,
    "70+": ages.filter((age) => age >= 70).length,
  };

  const lines = Object.entries(distribution).map(([range, count]) => `- ${range}: ${count}`);

  return textResult(
    `Age Distribution\n\n${lines.join("\n")}\n\nPercentiles\n- 25th percentile: ${percentile(25)}\n- Median: ${percentile(50)}\n- 75th percentile: ${percentile(75)}`,
    env.context
  );
}

async function officeInsight(env: ToolEnvironment, args: unknown): Promise<GenioTextResult> {
  const parsed = officeQuerySchema.safeParse(parseJsonObject(args));
  const input = parsed.success ? parsed.data : {};
  const resolved = await resolveOfficeOrReply(env.departmentId, input.office, env.message, env.context);
  if (resolved.result) return resolved.result;
  const office = resolved.office!;

  const officeCount = await prisma.employee.count({
    where: { departmentId: env.departmentId, isArchived: false, officeId: office.id },
  });
  const allCounts = await prisma.employee.groupBy({
    by: ["officeId"],
    where: { departmentId: env.departmentId, isArchived: false },
    _count: { _all: true },
  });

  const totalEmployees = allCounts.reduce((sum, item) => sum + item._count._all, 0);
  const average = allCounts.length ? totalEmployees / allCounts.length : 0;
  const hiresThisYear = await prisma.employee.count({
    where: {
      departmentId: env.departmentId,
      isArchived: false,
      officeId: office.id,
      dateHired: { gte: startOfYear(new Date().getFullYear()) },
    },
  });

  const headline =
    average > 0 && officeCount < average * 0.8
      ? "appears understaffed"
      : average > 0 && officeCount > average * 1.2
      ? "appears above average in staffing"
      : "has balanced staffing";

  const share = totalEmployees > 0 ? ((officeCount / totalEmployees) * 100).toFixed(1) : "0.0";

  return textResult(
    `Staffing insight for ${office.name}:\n\n${office.name} ${headline} based on current data.\n\n- Active employees: ${officeCount}\n- Department average per office: ${Math.round(average)}\n- New hires this year: ${hiresThisYear}\n- Workforce share: ${share}%`,
    {
      ...env.context,
      lastOfficeId: office.id,
      lastOfficeName: office.name,
    }
  );
}

async function compareOffices(env: ToolEnvironment, args: unknown): Promise<GenioTextResult> {
  const parsed = compareOfficesSchema.safeParse(parseJsonObject(args));
  const input = parsed.success ? parsed.data : {};
  const offices = await resolveManyOffices(env.departmentId, input.offices, env.message);
  if (offices.length < 2) {
    return textResult("Please specify two offices to compare.", env.context);
  }

  const [officeA, officeB] = offices;
  const stats = await Promise.all(
    [officeA, officeB].map(async (office) => {
      const [total, male, female] = await Promise.all([
        prisma.employee.count({ where: { departmentId: env.departmentId, isArchived: false, officeId: office.id } }),
        prisma.employee.count({ where: { departmentId: env.departmentId, isArchived: false, officeId: office.id, gender: Gender.Male } }),
        prisma.employee.count({ where: { departmentId: env.departmentId, isArchived: false, officeId: office.id, gender: Gender.Female } }),
      ]);
      return { office, total, male, female };
    })
  );

  const diff = stats[0].total - stats[1].total;
  const comparison =
    diff === 0
      ? "Both offices have the same number of active employees."
      : diff > 0
      ? `${officeA.name} has ${diff} more active employees than ${officeB.name}.`
      : `${officeB.name} has ${Math.abs(diff)} more active employees than ${officeA.name}.`;

  return textResult(
    `${officeA.name} vs ${officeB.name}:\n\n- ${officeA.name}: ${stats[0].total} employees (${stats[0].female} female, ${stats[0].male} male)\n- ${officeB.name}: ${stats[1].total} employees (${stats[1].female} female, ${stats[1].male} male)\n\n${comparison}`,
    {
      ...env.context,
      lastResult: {
        type: "compare_offices",
        officeIds: [officeA.id, officeB.id],
        filters: { officeIds: [officeA.id, officeB.id] },
      },
    },
    { canExport: true }
  );
}

async function compareEmployeeTypes(env: ToolEnvironment, args: unknown): Promise<GenioTextResult> {
  const parsed = compareOfficesSchema.safeParse(parseJsonObject(args));
  const input = parsed.success ? parsed.data : {};
  const offices = await resolveManyOffices(env.departmentId, input.offices, env.message);
  if (offices.length < 2) {
    return textResult("Please specify two offices to compare.", env.context);
  }

  const [officeA, officeB] = offices;

  async function getTypes(officeId: string) {
    const rows = await prisma.employee.groupBy({
      by: ["employeeTypeId"],
      where: { departmentId: env.departmentId, isArchived: false, officeId },
      _count: true,
    });
    const types = await prisma.employeeType.findMany({
      where: { departmentId: env.departmentId, id: { in: rows.map((row) => row.employeeTypeId) } },
    });
    return rows.map((row) => ({
      name: types.find((type) => type.id === row.employeeTypeId)?.name ?? "Unknown",
      count: row._count,
    }));
  }

  const [typesA, typesB] = await Promise.all([getTypes(officeA.id), getTypes(officeB.id)]);
  const allTypes = Array.from(new Set([...typesA.map((item) => item.name), ...typesB.map((item) => item.name)]));
  const lines = allTypes.map((type) => {
    const a = typesA.find((item) => item.name === type)?.count ?? 0;
    const b = typesB.find((item) => item.name === type)?.count ?? 0;
    return `- ${type}: ${officeA.name}: ${a}, ${officeB.name}: ${b}`;
  });

  return textResult(
    `Employee type comparison:\n\n${lines.join("\n")}`,
    {
      ...env.context,
      lastResult: {
        type: "compare_employee_types",
        officeIds: [officeA.id, officeB.id],
        filters: { officeIds: [officeA.id, officeB.id] },
      },
    },
    { canExport: true }
  );
}

async function topOffices(env: ToolEnvironment): Promise<GenioTextResult> {
  const offices = await prisma.offices.findMany({
    where: { departmentId: env.departmentId },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          employee: {
            where: { departmentId: env.departmentId, isArchived: false },
          },
        },
      },
    },
  });

  const sorted = offices
    .map((office) => ({ id: office.id, name: office.name, count: office._count.employee }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  if (!sorted.length) return textResult("No office data available.", env.context);

  return textResult(
    `Top 3 offices by size:\n\n${sorted
      .map((office, index) => `${index + 1}. ${escapeMarkdown(office.name)} - ${office.count} employees`)
      .join("\n")}`,
    {
      ...env.context,
      lastResult: {
        type: "top_offices",
        officeIds: sorted.map((office) => office.id),
        filters: { officeIds: sorted.map((office) => office.id) },
      },
    },
    { canExport: true }
  );
}

async function smallestOffice(env: ToolEnvironment): Promise<GenioTextResult> {
  const offices = await prisma.offices.findMany({
    where: { departmentId: env.departmentId },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          employee: {
            where: { departmentId: env.departmentId, isArchived: false },
          },
        },
      },
    },
  });

  const smallest = offices
    .map((office) => ({ id: office.id, name: office.name, count: office._count.employee }))
    .sort((a, b) => a.count - b.count)[0];

  if (!smallest) return textResult("No office data available.", env.context);

  return textResult(
    `The smallest office is ${smallest.name} with ${smallest.count} active employees.`,
    {
      ...env.context,
      lastResult: {
        type: "smallest_office",
        officeIds: [smallest.id],
        filters: { officeIds: [smallest.id] },
      },
    },
    { canExport: true }
  );
}

async function ageAnalysis(env: ToolEnvironment, args: unknown): Promise<GenioTextResult> {
  const parsed = ageAnalysisSchema.safeParse(parseJsonObject(args));
  if (!parsed.success) {
    return textResult("Please specify an age, like above 40, below 30, 25 to 35, or aged 30.", env.context);
  }

  let filters = genioFiltersSchema.parse({
    age: parsed.data.age,
    gender: parsed.data.gender,
    office: parsed.data.office,
  });
  filters = await resolveEmployeeFilter(env.departmentId, filters, env.message);

  const where = await buildEmployeeWhere(env.departmentId, filters);
  const count = await prisma.employee.count({ where });

  const label =
    typeof filters.age?.exact === "number"
      ? `${filters.age.exact} years old`
      : typeof filters.age?.min === "number" && typeof filters.age?.max === "number"
      ? `between ${filters.age.min} and ${filters.age.max}`
      : typeof filters.age?.min === "number"
      ? `${filters.age.min} and above`
      : `${filters.age?.max} and below`;
  const audience = filters.gender ? `${filters.gender.toLowerCase()} active employees` : "active employees";

  return textResult(
    `There are ${count} ${audience} aged ${label}${filters.officeName ? ` in ${filters.officeName}` : ""}.`,
    {
      ...env.context,
      lastResult: {
        type: "age_analysis",
        filters,
        label,
      },
    },
    { canExport: true }
  );
}

async function tenureAnalysis(env: ToolEnvironment, args: unknown): Promise<GenioTextResult> {
  const parsed = tenureAnalysisSchema.safeParse(parseJsonObject(args));
  if (!parsed.success) {
    return textResult("Please specify years of service, like more than 10 years or under 5 years.", env.context);
  }

  let filters = genioFiltersSchema.parse({
    tenure: parsed.data.tenure,
    gender: parsed.data.gender,
    office: parsed.data.office,
  });
  filters = await resolveEmployeeFilter(env.departmentId, filters, env.message);

  const where = await buildEmployeeWhere(env.departmentId, { ...filters, tenure: undefined });
  const employees = await prisma.employee.findMany({
    where,
    select: {
      id: true,
      dateHired: true,
      latestAppointment: true,
      terminateDate: true,
      isArchived: true,
      employmentEvents: {
        where: { deletedAt: null },
        select: { type: true, occurredAt: true, deletedAt: true },
      },
    },
  });

  const minTenure = filters.tenure?.min;
  const maxTenure = filters.tenure?.max;
  const matchedEmployees = employees.filter((employee) => {
    const tenure = computeTenure({
      dateHired: employee.dateHired,
      latestAppointment: employee.latestAppointment,
      terminateDate: employee.terminateDate,
      isArchived: employee.isArchived,
      employmentEvents: employee.employmentEvents,
    });

    if (typeof minTenure === "number" && tenure.totalServiceYears < minTenure) {
      return false;
    }
    if (typeof maxTenure === "number" && tenure.totalServiceYears > maxTenure) {
      return false;
    }
    return true;
  });
  const count = matchedEmployees.length;

  return textResult(
    `There are ${count} active employees matching that length of service${filters.officeName ? ` in ${filters.officeName}` : ""}.`,
    {
      ...env.context,
      lastResult: {
        type: "tenure_analysis",
        filters,
        employeeIds: matchedEmployees.slice(0, 500).map((employee) => employee.id),
      },
    },
    { canExport: true }
  );
}

async function currentEmployeesByYear(env: ToolEnvironment, args: unknown): Promise<GenioTextResult> {
  const parsed = yearSchema.safeParse(parseJsonObject(args));
  const year = parsed.success && parsed.data.year ? parsed.data.year : new Date().getFullYear();
  const yearEnd = endOfYear(year);

  const employees = await prisma.employee.findMany({
    where: {
      departmentId: env.departmentId,
      dateHired: { lte: yearEnd },
    },
    include: { employeeType: true },
    orderBy: { lastName: "asc" },
  });

  const currentEmployees = employees.filter((employee) => {
    const termination = parseUSDate(employee.terminateDate);
    return !termination || termination > yearEnd;
  });

  if (!currentEmployees.length) {
    return textResult(`No current employees as of ${year}.`, env.context);
  }

  const breakdown = new Map<string, number>();
  for (const employee of currentEmployees) {
    const typeName = employee.employeeType?.name ?? "Unknown";
    breakdown.set(typeName, (breakdown.get(typeName) ?? 0) + 1);
  }

  const breakdownList = [...breakdown.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `- ${name}: ${count}`)
    .join("\n");

  const sample = currentEmployees
    .slice(0, 20)
    .map((employee, index) => `${index + 1}. ${employee.lastName}, ${employee.firstName}`)
    .join("\n");
  const more = currentEmployees.length > 20 ? `\n...and ${currentEmployees.length - 20} more.` : "";

  return textResult(
    `There are ${currentEmployees.length} current employees as of ${year}.\n\nBreakdown by Employee Type\n${breakdownList}\n\nSample List\n${sample}${more}`,
    {
      ...env.context,
      lastResult: {
        type: "current_employees_by_year",
        filters: { year },
      },
    },
    { canExport: true }
  );
}

async function listLastResult(env: ToolEnvironment): Promise<GenioTextResult> {
  const last = env.context.lastResult;
  if (!last) {
    return textResult(
      "I do not have a previous result in this chat yet. Ask a count or filter question first, then ask me to list them.",
      env.context
    );
  }

  const employees = await employeesForLastResult(env.departmentId, last, 100);
  if (!employees.length) {
    return textResult("I could not find employees for the last result.", env.context);
  }

  return textResult(
    `Here they are (${employees.length} shown):\n\n${formatEmployeeList(employees, 100)}`,
    env.context,
    { canExport: true }
  );
}

async function showProfile(env: ToolEnvironment): Promise<GenioTextResult> {
  if (!env.context.lastEmployeeId) {
    return textResult("Please ask about an employee first.", env.context);
  }

  const employee = await prisma.employee.findFirst({
    where: {
      id: env.context.lastEmployeeId,
      departmentId: env.departmentId,
      isArchived: false,
    },
    select: { id: true },
  });

  if (!employee) {
    return textResult("I could not open that profile from the current department.", env.context);
  }

  return textResult("Here is the employee profile.", env.context, {
    viewProfileEmployeeId: employee.id,
  });
}

function exportFilename(last: GenioLastResult) {
  const timestamp = new Date()
    .toISOString()
    .slice(0, 16)
    .replace(/[-:T]/g, "");

  const base =
    last.type === "note_search"
      ? "employees-with-note"
      : last.type === "employee_no_prefix"
      ? `employees-starting-with-${last.filters?.employeeNoPrefix ?? "prefix"}`
      : last.type === "current_employees_by_year"
      ? `current-employees-${last.filters?.year ?? new Date().getFullYear()}`
      : last.type === "age_analysis"
      ? "employees-by-age"
      : last.type === "tenure_analysis"
      ? "employees-by-tenure"
      : last.type === "history_snapshot"
      ? `history-snapshot-${last.filters?.year ?? "results"}`
      : last.type === "award_analytics"
      ? `award-employees-${last.filters?.year ?? "results"}`
      : last.type === "employment_event_lookup"
      ? `employment-event-employees-${last.filters?.year ?? "results"}`
      : last.type === "list_heads"
      ? "office-heads"
      : "employees-export";

  return `${base}-${timestamp}.xlsx`
    .toLowerCase()
    .replace(/[^a-z0-9-_.]/g, "_");
}

async function exportLastResult(env: ToolEnvironment): Promise<GenioToolResult> {
  const last = env.context.lastResult;
  if (!last) {
    return textResult("Nothing to export yet. Ask Genio for a count or list first.", env.context);
  }

  const employees = await employeesForLastResult(env.departmentId, last);
  if (!employees.length) {
    return textResult("No data found to export.", env.context);
  }

  const rows = employees.map((employee) => ({
    "Employee No": employee.employeeNo,
    "Last Name": employee.lastName,
    "First Name": employee.firstName,
    "Contact Number": employee.contactNumber?.trim() ?? "",
    "M.I.": employee.middleName ? employee.middleName.charAt(0) : "",
    Suffix: employee.suffix ?? "",
    Position: employee.position,
    Office: employee.offices?.name ?? "",
    "Employee Type": employee.employeeType?.name ?? "",
    Gender: employee.gender,
    Status: employee.isArchived ? "Archived" : "Active",
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows, { skipHeader: false });
  const headerCells = Object.keys(rows[0]) as Array<keyof (typeof rows)[number]>;

  worksheet["!cols"] = headerCells.map((header) => ({
    wch:
      Math.max(header.length, ...rows.map((row) => String(row[header] ?? "").length)) + 2,
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Employees");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return {
    kind: "file",
    response: new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${exportFilename(last)}"`,
      },
    }),
  };
}

function employeeNameSearchWhere(query?: string): Prisma.EmployeeWhereInput | undefined {
  if (!query?.trim()) return undefined;
  const parts = query.trim().split(/\s+/).filter(Boolean).slice(0, 5);
  if (!parts.length) return undefined;

  return {
    AND: parts.map((part) => ({
      OR: [
        { firstName: { contains: part, mode: "insensitive" } },
        { middleName: { contains: part, mode: "insensitive" } },
        { lastName: { contains: part, mode: "insensitive" } },
        { nickname: { contains: part, mode: "insensitive" } },
        { employeeNo: { contains: part, mode: "insensitive" } },
      ],
    })),
  };
}

async function historySnapshot(env: ToolEnvironment, args: unknown): Promise<GenioTextResult> {
  const parsed = genioToolArgumentSchemas.history_snapshot.parse(parseJsonObject(args));
  const limit = parsed.limit ?? 25;
  const where: Prisma.EmployeeHistorySnapshotWhereInput = {
    departmentId: env.departmentId,
    ...(parsed.status ? { status: { contains: parsed.status, mode: "insensitive" } } : {}),
    ...(parsed.year ? { effectiveAt: { gte: startOfYear(parsed.year), lte: endOfYear(parsed.year) } } : {}),
  };

  if (parsed.office) {
    const { office, result } = await resolveOfficeOrReply(env.departmentId, parsed.office, env.message, env.context);
    if (result) return result;
    if (office) where.officeId = office.id;
  }

  const snapshots = await prisma.employeeHistorySnapshot.findMany({
    where,
    include: {
      employee: { select: { employeeNo: true, firstName: true, middleName: true, lastName: true } },
      office: { select: { name: true } },
      employeeType: { select: { name: true } },
      eligibility: { select: { name: true } },
    },
    orderBy: { effectiveAt: "desc" },
    take: limit,
  });

  if (!snapshots.length) {
    return textResult("No matching workforce history snapshots were found in the HRPS database.", env.context);
  }

  const rows = snapshots.map((snapshot, index) => {
    const employee = employeeName(snapshot.employee);
    const office = snapshot.office?.name ?? "No office";
    const type = snapshot.employeeType?.name ?? "No employee type";
    return `${index + 1}. ${employee} - ${office}, ${type}, ${snapshot.status} (${snapshot.effectiveAt.toLocaleDateString()})`;
  });

  return textResult(
    `Workforce history snapshots found:\n\n${rows.join("\n")}`,
    {
      ...env.context,
      lastResult: {
        type: "history_snapshot",
        filters: {
          year: parsed.year,
          office: parsed.office,
          officeId: typeof where.officeId === "string" ? where.officeId : undefined,
        },
        employeeIds: snapshots.map((snapshot) => snapshot.employeeId).slice(0, 500),
        label: parsed.year ? `workforce history snapshot ${parsed.year}` : "workforce history snapshot",
      },
    },
    { canExport: true }
  );
}

async function awardAnalytics(env: ToolEnvironment, args: unknown): Promise<GenioTextResult> {
  const parsed = genioToolArgumentSchemas.award_analytics.parse(parseJsonObject(args));
  const limit = parsed.limit ?? 25;
  const employeeFilter = employeeNameSearchWhere(parsed.employeeName);
  const awards = await prisma.award.findMany({
    where: {
      deletedAt: null,
      ...(parsed.year ? { givenAt: { gte: startOfYear(parsed.year), lte: endOfYear(parsed.year) } } : {}),
      employee: {
        departmentId: env.departmentId,
        isArchived: false,
        ...(employeeFilter ?? {}),
      },
    },
    include: {
      employee: {
        select: {
          employeeNo: true,
          firstName: true,
          middleName: true,
          lastName: true,
          offices: { select: { name: true } },
        },
      },
    },
    orderBy: { givenAt: "desc" },
    take: limit,
  });

  if (!awards.length) {
    return textResult("No matching awards were found in the HRPS database.", env.context);
  }

  const rows = awards.map((award, index) => {
    const employee = employeeName(award.employee);
    const office = award.employee.offices?.name ?? "No office";
    return `${index + 1}. ${award.title} - ${employee} (${office}), ${award.givenAt.toLocaleDateString()}`;
  });

  return textResult(
    `Awards from the HRPS database:\n\n${rows.join("\n")}`,
    {
      ...env.context,
      lastResult: {
        type: "award_analytics",
        filters: {
          year: parsed.year,
          query: parsed.employeeName,
        },
        employeeIds: awards.map((award) => award.employeeId).slice(0, 500),
        label: parsed.year ? `awards ${parsed.year}` : "awards",
      },
    },
    { canExport: true }
  );
}

async function employmentEventLookup(env: ToolEnvironment, args: unknown): Promise<GenioTextResult> {
  const parsed = genioToolArgumentSchemas.employment_event_lookup.parse(parseJsonObject(args));
  const limit = parsed.limit ?? 25;
  const employeeFilter = employeeNameSearchWhere(parsed.employeeName);
  const requestedEventType = parsed.eventType?.toUpperCase().replace(/\s+/g, "_");
  const eventType = requestedEventType && Object.values(EmploymentEventType).includes(requestedEventType as EmploymentEventType)
    ? requestedEventType as EmploymentEventType
    : undefined;

  const events = await prisma.employmentEvent.findMany({
    where: {
      deletedAt: null,
      ...(parsed.year ? { occurredAt: { gte: startOfYear(parsed.year), lte: endOfYear(parsed.year) } } : {}),
      ...(eventType ? { type: eventType } : {}),
      employee: {
        departmentId: env.departmentId,
        isArchived: false,
        ...(employeeFilter ?? {}),
      },
    },
    include: {
      employee: {
        select: {
          employeeNo: true,
          firstName: true,
          middleName: true,
          lastName: true,
          offices: { select: { name: true } },
        },
      },
    },
    orderBy: { occurredAt: "desc" },
    take: limit,
  });

  if (!events.length) {
    return textResult("No matching employment events were found in the HRPS database.", env.context);
  }

  const rows = events.map((event, index) => {
    const employee = employeeName(event.employee);
    const office = event.employee.offices?.name ?? "No office";
    return `${index + 1}. ${event.type} - ${employee} (${office}), ${event.occurredAt.toLocaleDateString()}`;
  });

  return textResult(
    `Employment events from the HRPS database:\n\n${rows.join("\n")}`,
    {
      ...env.context,
      lastResult: {
        type: "employment_event_lookup",
        filters: {
          year: parsed.year,
          query: parsed.employeeName,
        },
        employeeIds: events.map((event) => event.employeeId).slice(0, 500),
        label: parsed.year ? `employment events ${parsed.year}` : "employment events",
      },
    },
    { canExport: true }
  );
}

async function scheduleMetadata(env: ToolEnvironment, args: unknown): Promise<GenioTextResult> {
  const parsed = genioToolArgumentSchemas.schedule_metadata.parse(parseJsonObject(args));
  const limit = parsed.limit ?? 25;
  const employeeFilter = employeeNameSearchWhere(parsed.employeeName);

  if (parsed.office && !parsed.employeeName) {
    const { office, result } = await resolveOfficeOrReply(env.departmentId, parsed.office, env.message, env.context);
    if (result) return result;

    const officeSchedules = await prisma.officeWorkSchedule.findMany({
      where: {
        departmentId: env.departmentId,
        officeId: office.id,
      },
      include: { office: { select: { name: true } } },
      orderBy: { effectiveFrom: "desc" },
      take: limit,
    });

    if (!officeSchedules.length) {
      return textResult(`No office schedule metadata found for ${office.name}.`, env.context);
    }

    const rows = officeSchedules.map((schedule, index) => {
      const time = [schedule.startTime, schedule.endTime].filter(Boolean).join("-");
      return `${index + 1}. ${schedule.office.name}: ${schedule.type}${time ? ` ${time}` : ""}, effective ${schedule.effectiveFrom.toLocaleDateString()}`;
    });

    return textResult(`Office schedule metadata:\n\n${rows.join("\n")}`, env.context);
  }

  const schedules = await prisma.workSchedule.findMany({
    where: {
      employee: {
        departmentId: env.departmentId,
        isArchived: false,
        ...(employeeFilter ?? {}),
      },
    },
    include: {
      employee: {
        select: {
          firstName: true,
          middleName: true,
          lastName: true,
          offices: { select: { name: true } },
        },
      },
    },
    orderBy: { effectiveFrom: "desc" },
    take: limit,
  });

  if (!schedules.length) {
    return textResult("No matching employee schedule metadata was found in the HRPS database.", env.context);
  }

  const rows = schedules.map((schedule, index) => {
    const name = employeeName(schedule.employee);
    const office = schedule.employee.offices?.name ?? "No office";
    const time = [schedule.startTime, schedule.endTime].filter(Boolean).join("-");
    return `${index + 1}. ${name} (${office}): ${schedule.type}${time ? ` ${time}` : ""}, effective ${schedule.effectiveFrom.toLocaleDateString()}`;
  });

  return textResult(`Schedule metadata only:\n\n${rows.join("\n")}`, env.context);
}

async function notAnswerable(env: ToolEnvironment, args: unknown): Promise<GenioTextResult> {
  const parsed = genioToolArgumentSchemas.not_answerable.parse(parseJsonObject(args));
  return textResult(notAnswerableMessage(parsed), env.context);
}

export async function executeGenioTool(
  name: string,
  args: unknown,
  env: ToolEnvironment
): Promise<GenioToolResult | null> {
  switch (name as GenioToolName) {
    case "lookup_employees":
      return lookupEmployees(env, args);
    case "employee_extreme":
      return employeeExtreme(env, args);
    case "count_employees":
      return countEmployees(env, args);
    case "office_distribution":
      return officeDistribution(env, args);
    case "list_offices":
      emptySchema.parse(parseJsonObject(args));
      return listOffices(env);
    case "list_office_heads":
      emptySchema.parse(parseJsonObject(args));
      return listOfficeHeads(env);
    case "who_is_office_head":
      return whoIsOfficeHead(env, args);
    case "check_office_head":
      return checkOfficeHead(env, args);
    case "offices_without_head":
      emptySchema.parse(parseJsonObject(args));
      return officesWithoutHead(env);
    case "gender_distribution":
      return genderDistribution(env, args);
    case "age_distribution":
      emptySchema.parse(parseJsonObject(args));
      return ageDistribution(env);
    case "office_insight":
      return officeInsight(env, args);
    case "compare_offices":
      return compareOffices(env, args);
    case "compare_employee_types":
      return compareEmployeeTypes(env, args);
    case "top_offices":
      emptySchema.parse(parseJsonObject(args));
      return topOffices(env);
    case "smallest_office":
      emptySchema.parse(parseJsonObject(args));
      return smallestOffice(env);
    case "age_analysis":
      return ageAnalysis(env, args);
    case "tenure_analysis":
      return tenureAnalysis(env, args);
    case "current_employees_by_year":
      return currentEmployeesByYear(env, args);
    case "list_last_result":
      emptySchema.parse(parseJsonObject(args));
      return listLastResult(env);
    case "show_profile":
      emptySchema.parse(parseJsonObject(args));
      return showProfile(env);
    case "export_last_result":
      emptySchema.parse(parseJsonObject(args));
      return exportLastResult(env);
    case "history_snapshot":
      return historySnapshot(env, args);
    case "award_analytics":
      return awardAnalytics(env, args);
    case "employment_event_lookup":
      return employmentEventLookup(env, args);
    case "schedule_metadata":
      return scheduleMetadata(env, args);
    case "not_answerable":
      return notAnswerable(env, args);
    default:
      return null;
  }
}
