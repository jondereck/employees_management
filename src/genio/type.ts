  // src/genio/types.ts
export type GenioIntent = {
  action:
    | "count"
    | "list"
    | "describe_employee"
    | "show_profile"
    | "distribution"
     | "list_offices"
     | "list_from_last_count"
    | "insight"
    | "unknown";

  target?: "employee" | "office" | "department";

  filters: {
    gender?: "Male" | "Female";
    office?: string;
    employeeType?: string;
    age?: { min?: number; max?: number };
    hired?: "this_year" | "recent";
  };

  followUp?: boolean;
};
