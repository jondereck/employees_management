import { parseGenioIntent } from "@/src/genio/parse-intent";
import { handleCount } from "../handlers/handleCount";
import { handleListFromLastCount } from "../handlers/handleListFromLastCount";
import { handleCompareOffices } from "../handlers/handleCompareOffices";
import { handleAgeDistribution } from "../handlers/handleAgeDistribution";
import { handleExport } from "../handlers/handleExport";
import { handleInsight } from "../handlers/handleInsight";
import { handleTopOffices } from "../handlers/handleTopOffices";

type ToolArgs = Record<string, unknown>;

export type GenioToolName =
  | "countEmployees"
  | "listEmployees"
  | "compareOffices"
  | "ageDistribution"
  | "topOffices"
  | "exportEmployees"
  | "workforceInsights";

export type GenioToolContext = Record<string, unknown>;

export type GenioToolExecutor = (params: {
  args: ToolArgs;
  context: GenioToolContext;
  userMessage: string;
}) => Promise<Response>;

function getTextArg(args: ToolArgs, key: string): string | null {
  const value = args[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export const genioToolMap: Record<GenioToolName, GenioToolExecutor> = {
  countEmployees: async ({ args, context, userMessage }) => {
    const query = getTextArg(args, "query") ?? userMessage;
    const { intent } = parseGenioIntent(query, context);
    return handleCount(intent, context, query);
  },
  listEmployees: async ({ args, context, userMessage }) => {
    const query = getTextArg(args, "query") ?? userMessage;
    const { intent } = parseGenioIntent(query, context);

    const countResponse = await handleCount(intent, context, query);
    const updatedContextHeader = countResponse.headers.get("x-genio-context");

    if (!updatedContextHeader) {
      return handleListFromLastCount(context);
    }

    const parsedContext = JSON.parse(updatedContextHeader) as GenioToolContext;
    return handleListFromLastCount(parsedContext);
  },
  compareOffices: async ({ args, context, userMessage }) => {
    const officeA = getTextArg(args, "officeA");
    const officeB = getTextArg(args, "officeB");
    const query = officeA && officeB ? `${officeA} vs ${officeB}` : userMessage;
    return handleCompareOffices(query, context);
  },
  ageDistribution: async ({ context }) => handleAgeDistribution(context),
  topOffices: async ({ context }) => handleTopOffices(context),
  exportEmployees: async ({ context }) => handleExport(context),
  workforceInsights: async ({ args, context, userMessage }) => {
    const query = getTextArg(args, "query") ?? userMessage;
    return handleInsight(query, context);
  },
};
