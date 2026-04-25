import { handleAgeDistribution } from "../handlers/handleAgeDistribution";
import { handleCompareOffices } from "../handlers/handleCompareOffices";
import { handleCount } from "../handlers/handleCount";
import { handleExport } from "../handlers/handleExport";
import { handleInsight } from "../handlers/handleInsight";
import { handleListFromLastCount } from "../handlers/handleListFromLastCount";
import { handleTopOffices } from "../handlers/handleTopOffices";
import { GenioIntent } from "../type";

type GenioContext = Record<string, unknown>;
type ToolArgs = Record<string, unknown>;

export type GenioToolFn = (
  args: ToolArgs,
  context: GenioContext,
  message: string
) => Promise<Response>;

function parseStringArg(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseGender(value: unknown): "Male" | "Female" | undefined {
  if (value === "Male" || value === "Female") {
    return value;
  }

  return undefined;
}

const countEmployees: GenioToolFn = async (args, context, message) => {
  const office = parseStringArg(args.office);
  const gender = parseGender(args.gender);
  const employeeType = parseStringArg(args.employeeType);

  const intent: GenioIntent = {
    action: "count",
    filters: {
      ...(office ? { office } : {}),
      ...(gender ? { gender } : {}),
      ...(employeeType ? { employeeType } : {}),
    },
  };

  return handleCount(intent, context, message);
};

const listEmployees: GenioToolFn = async (args, context) => {
  const office = parseStringArg(args.office);

  if (office) {
    const countIntent: GenioIntent = {
      action: "count",
      filters: { office },
    };

    const countResponse = await handleCount(countIntent, context, `count employees in ${office}`);
    const countContextRaw = countResponse.headers.get("x-genio-context");

    if (countContextRaw) {
      try {
        const parsedContext = JSON.parse(countContextRaw) as unknown;
        if (parsedContext && typeof parsedContext === "object" && !Array.isArray(parsedContext)) {
          return handleListFromLastCount(parsedContext as GenioContext);
        }
      } catch {
        return handleListFromLastCount(context);
      }
    }
  }

  return handleListFromLastCount(context);
};

const compareOffices: GenioToolFn = async (args, context) => {
  const officeA = parseStringArg(args.officeA);
  const officeB = parseStringArg(args.officeB);

  if (!officeA || !officeB) {
    return new Response("Please specify two offices to compare.", {
      headers: {
        "Content-Type": "text/plain",
        "x-genio-context": JSON.stringify(context),
      },
    });
  }

  return handleCompareOffices(`${officeA} vs ${officeB}`, context);
};

const ageDistribution: GenioToolFn = async (_, context) =>
  handleAgeDistribution(context);

const exportEmployees: GenioToolFn = async (_, context) =>
  handleExport(context);

const workforceInsights: GenioToolFn = async (args, context, message) => {
  const office = parseStringArg(args.office);
  const officePrompt = office ? `insight for ${office}` : message;

  return handleInsight(officePrompt, context);
};

const topOffices: GenioToolFn = async (_, context) =>
  handleTopOffices(context);

export const genioToolMap: Record<string, GenioToolFn> = {
  countEmployees,
  listEmployees,
  compareOffices,
  ageDistribution,
  exportEmployees,
  workforceInsights,
  topOffices,
};

export type GenioToolName = keyof typeof genioToolMap;
