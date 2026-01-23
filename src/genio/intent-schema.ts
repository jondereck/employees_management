export type GenioIntent = {
  action: "count" | "list" | "profile" | "unknown";

  filters: {
    gender?: "Male" | "Female";
    employeeType?: string;
    office?: string;
    hired?: "this_year" | "recent" | "any";
    age?: {
      min?: number;
      max?: number;
    };
  };
};
