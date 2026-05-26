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
  {
    type: "function",
    function: {
      name: "eligibility_query",
      description: "Count, list, or summarize active employees by eligibility such as Civil Service Professional, or find missing eligibility.",
      parameters: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["count", "list", "missing", "distribution"] },
          eligibilityName: { type: "string" },
          limit: { type: "number" },
        },
        required: ["mode"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "employee_type_query",
      description: "Count, list, compare, or summarize active employees by employee type such as Regular, Casual, COS, or Job Order.",
      parameters: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["count", "list", "distribution", "compare"] },
          employeeType: { type: "string" },
          employeeTypes: { type: "array", items: { type: "string" } },
          limit: { type: "number" },
        },
        required: ["mode"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "salary_grade_query",
      description: "Answer salary-grade-only analytics without exposing exact salary amounts.",
      parameters: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["count", "distribution", "highest", "missing"] },
          salaryGrade: { type: "number" },
          limit: { type: "number" },
        },
        required: ["mode"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "retirement_query",
      description: "List age-risk or retirement candidate employees from birthday data.",
      parameters: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["near_retirement", "age_at_least", "retirement_this_year"] },
          age: { type: "number" },
          limit: { type: "number" },
        },
        required: ["mode"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "data_quality_query",
      description: "Find active employees with missing profile data such as employee number, office, birthday, or latest appointment.",
      parameters: {
        type: "object",
        properties: {
          field: { type: "string", enum: ["birthday", "employee_number", "office", "latest_appointment"] },
          limit: { type: "number" },
        },
        required: ["field"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "public_profile_query",
      description: "Count or list active employees by public profile enabled or disabled status.",
      parameters: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["enabled", "disabled", "count_enabled"] },
          limit: { type: "number" },
        },
        required: ["mode"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "office_staffing_query",
      description: "Find offices with no active employees or only one active employee.",
      parameters: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["empty_offices", "single_employee_offices"] },
          limit: { type: "number" },
        },
        required: ["mode"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "designation_query",
      description: "List active employees with designation office data or mismatches between assigned office and designation office.",
      parameters: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["with_designation", "designation_mismatch"] },
          office: { type: "string" },
          limit: { type: "number" },
        },
        required: ["mode"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "award_query",
      description: "Direct award queries such as awards this year, most awarded employees, awards by issuer, or employees without awards.",
      parameters: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["this_year", "most_awarded", "by_issuer", "without_awards"] },
          issuer: { type: "string" },
          year: { type: "number" },
          limit: { type: "number" },
        },
        required: ["mode"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "employment_event_query",
      description: "Direct employment event queries such as promoted in a year, transferred this year, recent hires, or employees without events.",
      parameters: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["by_type", "recent_hires", "without_events"] },
          eventType: { type: "string" },
          year: { type: "number" },
          limit: { type: "number" },
        },
        required: ["mode"],
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
