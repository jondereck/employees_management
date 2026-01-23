  // src/genio/types.ts
export type GenioIntent = {
  action:
    | "count"
    | "list"
    | "describe_employee"
    | "show_profile"
    | "distribution"
     | "list_offices"
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
