import { GenioIntent } from "./type";

export function parseGenioIntent(
  message: string,
  context?: any
): { intent: GenioIntent; confidence: number } {
  const text = message.toLowerCase();
  let confidence = 0;

  const intent: GenioIntent = {
    action: "unknown",
    filters: {},
  };


  /* ===============================
   OFFICE HEAD INTENTS
   =============================== */

// Who is the head of X?
if (/who is the head of/i.test(text)) {
  return {
    intent: {
      action: "who_is_head",
      filters: {},
    },
    confidence: 4,
  };
}

// Is [name] the head of X?
if (/^is .* the head of /i.test(text)) {
  return {
    intent: {
      action: "is_head",
      filters: {},
    },
    confidence: 4,
  };
}

// Which offices don't have a head?
if (/which offices.*(dont|do not).*head/i.test(text)) {
  return {
    intent: {
      action: "offices_no_head",
      filters: {},
    },
    confidence: 4,
  };
}

// List all office heads
if (/list all office heads/i.test(text)) {
  return {
    intent: {
      action: "list_heads",
      filters: {},
    },
    confidence: 4,
  };
}

  /* ===============================
     FOLLOW-UP: LIST FROM LAST COUNT
     =============================== */
  if (
    context?.lastCountQuery &&
    /\b(who is it|who are they|sino sila|sino siya)\b/.test(text)
  ) {
    return {
      intent: {
        action: "list_from_last_count",
        filters: {},
        followUp: true,
      },
      confidence: 4,
    };
  }

  /* ===============================
     FOLLOW-UP: COUNT CONTINUATION
     =============================== */
  if (context?.lastCountQuery) {
    if (/\b(male|men|man|female|women|woman|lalaki|babae)\b/.test(text)) {
      return {
        intent: {
          action: "count",
          filters: {},
          followUp: true,
        },
        confidence: 3,
      };
    }

    if (/\b(what about|paano naman|kamusta naman)\b/.test(text)) {
      return {
        intent: {
          action: "count",
          filters: {},
          followUp: true,
        },
        confidence: 3,
      };
    }
  }

  /* ===============================
     EXPORT
     =============================== */
  if (/\b(export|download|export to excel|export this|export results)\b/.test(text)) {
    return {
      intent: {
        action: "export",
        filters: {},
        followUp: true,
      },
      confidence: 4,
    };
  }

  /* ===============================
     WHO IS (EMPLOYEE)
     =============================== */
  if (text.startsWith("who is")) {
    return {
      intent: {
        action: "describe_employee",
        target: "employee",
        filters: {},
      },
      confidence: 4,
    };
  }

  /* ===============================
     COUNT
     =============================== */
  if (/\b(how many|ilan|ilang|count|number of|total)\b/.test(text)) {
    intent.action = "count";
    confidence += 2;
  }

  /* ===============================
     DISTRIBUTION
     =============================== */
  if (/\b(distribution|breakdown|ratio)\b/.test(text)) {
    intent.action = "distribution";
    confidence += 2;
  }

  /* ===============================
     LIST OFFICES
     =============================== */
  if (
    /\b(list|show|display)\b/.test(text) &&
    /\boffice(s)?\b/.test(text)
  ) {
    return {
      intent: {
        action: "list_offices",
        filters: {},
      },
      confidence: 4,
    };
  }

  /* ===============================
     INSIGHT / WHY
     =============================== */
  if (/\b(why is|why does|why are)\b/.test(text)) {
    intent.action = "insight";
    confidence += 2;

    if (text.includes("office")) intent.target = "office";
    if (text.includes("department")) intent.target = "department";
  }

  /* ===============================
     EMPLOYEE TYPE FILTERS
     =============================== */
  if (/\bcasual\b/.test(text)) {
    intent.filters.employeeType = "casual";
    confidence += 1;
  }

  if (/\b(permanent|regular)\b/.test(text)) {
    intent.filters.employeeType = "permanent";
    confidence += 1;
  }

  if (/\b(contract|cos)\b/.test(text)) {
    intent.filters.employeeType = "contract";
    confidence += 1;
  }

  /* ===============================
     GENDER FILTERS
     =============================== */
  if (/\b(female|women|woman|babae)\b/.test(text)) {
    intent.filters.gender = "Female";
    confidence += 1;
  }

  if (/\b(male|men|man|lalaki)\b/.test(text)) {
    intent.filters.gender = "Male";
    confidence += 1;
  }

  /* ===============================
     AGE FILTERS
     =============================== */
  const above = text.match(/(above|older than)\s*(\d+)/);
  const below = text.match(/(below|younger than)\s*(\d+)/);

  if (above) {
    intent.filters.age = { min: Number(above[2]) };
    confidence += 1;
  }

  if (below) {
    intent.filters.age = { max: Number(below[2]) - 1 };
    confidence += 1;
  }

  /* ===============================
     COMPARE OFFICES
     =============================== */
  if (/\b(which office has more|compare|vs|versus|more employees)\b/.test(text)) {
    return {
      intent: {
        action: "compare_offices",
        filters: {},
      },
      confidence: 4,
    };
  }

  /* ===============================
     TOP OFFICES
     =============================== */
  if (/\b(top|largest|most employees)\b/.test(text)) {
    return {
      intent: {
        action: "top_offices",
        filters: {},
      },
      confidence: 4,
    };
  }

  /* ===============================
     SMALLEST OFFICE
     =============================== */
  if (/\b(smallest|least employees)\b/.test(text)) {
    return {
      intent: {
        action: "smallest_office",
        filters: {},
      },
      confidence: 4,
    };
  }

  /* ===============================
     COMPARE EMPLOYEE TYPES
     =============================== */
  if (
    /\bcompare\b/.test(text) &&
    /\b(employee type|permanent|contract|casual)\b/.test(text)
  ) {
    return {
      intent: {
        action: "compare_employee_types",
        filters: {},
      },
      confidence: 4,
    };
  }

  /* ===============================
     FINAL RETURN
     =============================== */
  return {
    intent,
    confidence,
  };
}
