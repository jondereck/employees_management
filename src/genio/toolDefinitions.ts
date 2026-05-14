import { GENIO_OPENAI_TOOLS as EXISTING_GENIO_OPENAI_TOOLS } from "./tools";

export const notAnswerableToolDefinition = {
  type: "function",
  function: {
    name: "not_answerable",
    description:
      "Use when the question cannot be answered using available HRPS database fields, requests sensitive restricted data, asks for external facts, is ambiguous, or asks Genio to perform a write action.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        reason: {
          type: "string",
          enum: [
            "missing_database_field",
            "write_action_not_allowed",
            "outside_hrps_scope",
            "ambiguous_question",
            "sensitive_data_restricted",
          ],
        },
        missingData: { type: "string" },
        suggestedQuestions: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["reason"],
    },
  },
} as const;

export const genioDomainToolDefinitions = [
  {
    type: "function",
    function: {
      name: "history_snapshot",
      description:
        "Answer workforce history snapshot questions from the HRPS database, such as active employees as of a year, historical office assignment, or status snapshots.",
      parameters: {
        type: "object",
        properties: {
          year: { type: "number" },
          office: { type: "string" },
          status: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "award_analytics",
      description:
        "Look up awards and recognition from the HRPS database by employee or year.",
      parameters: {
        type: "object",
        properties: {
          employeeName: { type: "string" },
          year: { type: "number" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "employment_event_lookup",
      description:
        "Look up employment events such as hired, promoted, transferred, reassigned, awarded, contract renewal, terminated, or other.",
      parameters: {
        type: "object",
        properties: {
          employeeName: { type: "string" },
          eventType: { type: "string" },
          year: { type: "number" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_metadata",
      description:
        "Answer schedule metadata questions only. Use for work schedules, office schedules, schedule exceptions, weekly exclusions, or custom schedules. Do not use for lateness, absence, undertime, overtime, or attendance-log analytics.",
      parameters: {
        type: "object",
        properties: {
          employeeName: { type: "string" },
          office: { type: "string" },
          date: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
] as const;

export const GENIO_OPENAI_TOOLS = [
  ...EXISTING_GENIO_OPENAI_TOOLS,
  ...genioDomainToolDefinitions,
  notAnswerableToolDefinition,
] as const;
