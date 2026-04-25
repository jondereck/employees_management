import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const genioTools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "countEmployees",
      description:
        "Get employee totals. Supports filters like office, gender, and employee type from natural language query.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Natural language query to count employees, e.g. 'How many female employees in Lingayen?'",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listEmployees",
      description:
        "List employees based on the latest relevant count/filter context. For office-specific lists, include that in query.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Natural language query, e.g. 'List employees in Lingayen'.",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compareOffices",
      description: "Compare employee counts between two offices.",
      parameters: {
        type: "object",
        properties: {
          officeA: { type: "string" },
          officeB: { type: "string" },
        },
        required: ["officeA", "officeB"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ageDistribution",
      description: "Show age distribution of active employees.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "topOffices",
      description: "Show top offices by number of active employees.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "exportEmployees",
      description:
        "Export the current filtered employee dataset to an XLSX file. Use only when user explicitly requests export/download.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "workforceInsights",
      description:
        "Generate staffing insights for a specific office, e.g. 'Give workforce insights for Lingayen office'.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Natural language query containing target office.",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
];
