// src/genio/types.ts

export type GenioAction =
  | "count"
  | "list"
  | "describe_employee"
  | "show_profile"
  | "distribution"
  | "list_offices"
  | "list_from_last_count"
  | "insight"
  | "ai_answer"
  | "export"
  | "compare_offices"
  | "top_offices"
  | "smallest_office"
  | "compare_employee_types"
   | "who_is_head"
  | "is_head"
  | "list_heads"
  | "offices_no_head"
    | "age_analysis"
  | "tenure_analysis"
  | "unknown";
export type GenioIntent = {
  action: GenioAction;

  target?: "employee" | "office" | "department";

  filters: {
    gender?: "Male" | "Female";
    office?: string;
    employeeType?: string;
    age?: { min?: number; max?: number };
     tenure?: { min?: number; max?: number }; 
    hired?: "this_year" | "recent";
  };

  followUp?: boolean;
};
