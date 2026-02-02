import { GENIO_NL_PATTERNS } from "./natural-language-map";
import { GenioAction, GenioIntent } from "./type";

function matchNLPatterns(text: string): GenioAction | null {
  for (const entry of GENIO_NL_PATTERNS) {
    for (const phrase of entry.patterns) {
      if (text.includes(phrase)) {
        return entry.action;
      }
    }
  }
  return null;
}


export function parseGenioIntent(
  message: string,
  context?: any
): { intent: GenioIntent; confidence: number } {
 

  let confidence = 0;

const text = message
  .toLowerCase()
  .replace(/[^\w\s,]/g, "");


const intent: GenioIntent = {
  action: "unknown",
  filters: {},
};

if (/\bnote\b/.test(text)) {
  const noteMatch =
    text.match(/\bnote\s+(.*)$/i) ||
    text.match(/may note na\s+(.*)$/i);

  if (noteMatch?.[1]) {
    const notes = noteMatch[1]
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);

    return {
      intent: {
        action: "describe_employee",
        filters: {
          note: notes.join(","), // store as CSV or array (see below)
        },
      },
      confidence: 10,
    };
  }
}





    /* ===============================
     CURRENT EMPLOYEES (BY YEAR)
     =============================== */

  if (
    /\b(current|active)\b/.test(text) &&
    /\b(employee|employees|staff)\b/.test(text)
  ) {
    const yearMatch = text.match(/\b(19|20)\d{2}\b/);

    return {
      intent: {
        action: "current_employees_by_year",
        filters: {
          ...(yearMatch && { year: Number(yearMatch[0]) }),
        },
      },
      confidence: 5,
    };
  }

/* ===============================
   EMPLOYEE NO PREFIX (GENERIC)
   =============================== */

const prefixMatch =
  text.match(/starting with\s*(\d{2,})/) ||
  text.match(/\bbio\s*(\d{2,})/) ||
  text.match(/\b(\d{3,})\b/);

if (prefixMatch?.[1]) {
  return {
    intent: {
      action: "describe_employee",
      filters: {
        employeeNoPrefix: prefixMatch[1], // ✅ numeric only
      },
    },
    confidence: 8,
  };
}


/* ===============================
   NATURAL LANGUAGE MAP (PRIMARY)
   =============================== */

const matchedAction = matchNLPatterns(text);
if (matchedAction) {
  return {
    intent: {
      action: matchedAction,
      filters: {},
    },
    confidence: 4,
  };
}


  
/* ===============================
   NATURAL LANGUAGE MAP (PRIMARY)
   =============================== */



if (matchedAction) {
  // special handling for year-based queries
  if (matchedAction === "current_employees_by_year") {
    const yearMatch = text.match(/\b(19|20)\d{2}\b/);
    const now = new Date().getFullYear();

    let year: number | undefined = yearMatch
      ? Number(yearMatch[0])
      : undefined;

    if (/\blast year\b|\bnakaraang taon\b/.test(text)) {
      year = now - 1;
    }

    if (/\bthis year\b|\bngayong taon\b/.test(text)) {
      year = now;
    }

    return {
      intent: {
        action: matchedAction,
        filters: {
          ...(year && { year }),
        },
      },
      confidence: 5,
    };
  }

  return {
    intent: {
      action: matchedAction,
      filters: {},
    },
    confidence: 4,
  };
}






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
   AGE DISTRIBUTION
   =============================== */
if (/\b(age distribution|age breakdown|age percentile|age demographics)\b/.test(text)) {
  return {
    intent: {
      action: "age_distribution",
      filters: {},
    },
    confidence: 5,
  };
}


  /* ===============================
   AGE EXACT (NEW)
   =============================== */
const exactAgeMatch =
  text.match(/\b(age|aged|years old)\s*(\d{1,3})\b/) ||
  text.match(/\b(\d{1,3})\s*(years old)\b/);

if (exactAgeMatch) {
  const age = Number(exactAgeMatch[2] ?? exactAgeMatch[1]);

  if (!isNaN(age)) {
    return {
      intent: {
        action: "age_analysis",
        filters: {
          age: {
            exact: age,
          },
        },
      },
      confidence: 5,
    };
  }
}


  /* ===============================
   AGE RANGE (NEW)
   =============================== */
const rangeMatch =
  text.match(/\b(\d{1,3})\s*(to|-|–)\s*(\d{1,3})\b/) ||
  text.match(/\bbetween\s+(\d{1,3})\s+and\s+(\d{1,3})\b/);

if (rangeMatch) {
  const min = Number(rangeMatch[1]);
  const max = Number(rangeMatch[3] ?? rangeMatch[2]);

  if (!isNaN(min) && !isNaN(max)) {
    return {
      intent: {
        action: "age_analysis",
        filters: {
          age: {
            min,
            max,
          },
        },
      },
      confidence: 5,
    };
  }
}

    /* ===============================
   AGE FILTER (FINAL – CORRECT)
   =============================== */
const aboveAge = text.match(/(above|older than|over|more than)\s*(\d+)/);
const belowAge = text.match(/(below|younger than|under|less than)\s*(\d+)/);

if (aboveAge || belowAge) {
  return {
    intent: {
      action: "age_analysis",
      filters: {
        age: {
          ...(aboveAge && { min: Number(aboveAge[2]) }),
          ...(belowAge && { max: Number(belowAge[2]) }),
        },
      },
    },
    confidence: 5,
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
   AGE FILTER (FIXED)
   =============================== */



/* ===============================
   TENURE ANALYSIS
   =============================== */

if (
  /\b(tenure|years?\s+of\s+service|years?\s+in\s+service|employed\s+for|worked\s+for)\b/.test(text)
) {
  const above =
    text.match(/(more than|over|above)\s*(\d+)/) ||
    text.match(/at least\s*(\d+)/);

  const below =
    text.match(/(less than|under|below)\s*(\d+)/) ||
    text.match(/at most\s*(\d+)/);

  const range =
    text.match(/(\d+)\s*(to|-)\s*(\d+)/);

  return {
    intent: {
      action: "tenure_analysis",
      filters: {
        tenure: {
          ...(above && { min: Number(above[2] ?? above[1]) }),
          ...(below && { max: Number(below[2] ?? below[1]) }),
          ...(range && {
            min: Number(range[1]),
            max: Number(range[3]),
          }),
        },
      },
    },
    confidence: 5,
  };
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
