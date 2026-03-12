import { ChatCompletionTool } from "openai/resources/chat/completions";

export const genioTools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "countEmployees",
      description:
        "Get employee count with optional filters such as office, gender, and employee type.",
      parameters: {
        type: "object",
        properties: {
          office: {
            type: "string",
            description: "Office name to filter by.",
          },
          gender: {
            type: "string",
            enum: ["Male", "Female"],
            description: "Gender filter.",
          },
          employeeType: {
            type: "string",
            description: "Employee type filter (e.g., Regular, COS).",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listEmployees",
      description:
        "List employees. Include office when user asks to list employees in a specific office.",
      parameters: {
        type: "object",
        properties: {
          office: {
            type: "string",
            description: "Office name to scope the list request.",
          },
        },
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
      description: "Show age distribution and percentiles for active employees.",
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
      description: "Export the latest query result as an Excel file.",
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
      description: "Get workforce insights for a specific office.",
      parameters: {
        type: "object",
        properties: {
          office: {
            type: "string",
            description: "Office name for insight analysis.",
          },
        },
        required: ["office"],
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
];
