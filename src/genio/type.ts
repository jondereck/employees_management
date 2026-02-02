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
  | "current_employees_by_year"
|  "age_distribution"
  | "unknown";
export type GenioIntent = {
  action: GenioAction;

  target?: "employee" | "office" | "department";

  filters: {
    name?: string;
    gender?: "Male" | "Female";
    note?: string;
    notes?: string[];
    employeeNoPrefix?: string;
    office?: string;
    employeeType?: string;
    age?: { min?: number; max?: number; exact?: number; };
    exactAge?: number;
     tenure?: { min?: number; max?: number }; 
    hired?: "this_year" | "recent";
    year?: number;
  };

  followUp?: boolean;
};
