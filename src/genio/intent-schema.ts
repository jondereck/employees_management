export type GenioIntent = {
  action: "count" | "list" | "profile" | "unknown";

  filters: {
    name?: string;
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
