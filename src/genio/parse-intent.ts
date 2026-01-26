import { GenioIntent } from "./type";


export async function parseGenioIntent(
  message: string,
  context?: any
): Promise<GenioIntent> {
  const text = message.toLowerCase();

  const intent: GenioIntent = {
    action: "unknown",
    filters: {},
  };


  

/* ===============================
   FOLLOW-UP INTENT (CONTEXT-AWARE)
   =============================== */


   /* ===============================
   FOLLOW-UP: WHO IS IT / WHO ARE THEY
   =============================== */
   

if (
  context?.lastCountQuery &&
  /\b(who is it|who are they|sino sila|sino siya)\b/.test(text)
) {
  return {
    action: "list_from_last_count",
    filters: {},
    followUp: true,
  };
}


if (context?.lastCountQuery) {
  // Gender-only follow-ups
  if (/\b(male|men|man|female|women|woman|lalaki|babae)\b/.test(text)) {
    return {
      action: "count",
      filters: {},
      followUp: true,
    };
  }

  // Short count follow-ups (Taglish)
  if (
    /\b(ilan|ilang|how many)\b/.test(text) &&
    !/\boffice|department|division\b/.test(text)
  ) {
    return {
      action: "count",
      filters: {},
      followUp: true,
    };
  }

  // “What about …”
  if (/\b(what about|paano naman|kamusta naman)\b/.test(text)) {
    return {
      action: "count",
      filters: {},
      followUp: true,
    };
  }
}


     
if (/\b(how many|ilan|ilang|count|number of|total)\b/.test(text)) {
  intent.action = "count";

if (
  context?.lastCountQuery &&
  /\b(in|sa)\s+[a-z]/.test(text)
) {
  return {
    action: "count",
    filters: {},
    followUp: true,
  };
}
}

  if (
    /\b(who are they|list them|show them|those employees)\b/.test(text)
  ) {
    intent.action = "list";
    intent.followUp = true;
    return intent;
  }

  if (
    /\b(show profile|open profile|view profile)\b/.test(text)
  ) {
    intent.action = "show_profile";
    intent.followUp = true;
    return intent;
  }

  /* ===============================
     WHO IS (EMPLOYEE)
     =============================== */
  if (text.startsWith("who is")) {
    intent.action = "describe_employee";
    intent.target = "employee";
    return intent;
  }

  /* ===============================
     COUNT / TOTAL
     =============================== */
  if (
    /\b(how many|count|number of|total)\b/.test(text)
  ) {
    intent.action = "count";
  }

  /* ===============================
     DISTRIBUTION
     =============================== */
  if (
    /\b(distribution|breakdown|ratio)\b/.test(text)
  ) {
    intent.action = "distribution";
  }

// LIST OFFICES
if (
  /\b(list|show|display)\b/.test(text) &&
  /\boffice(s)?\b/.test(text)
) {
  return {
    action: "list_offices",
    filters: {},
  };
}

  if (
  /\b(why is|why does|why are)\b/.test(text)
) {
  intent.action = "insight";

  if (text.includes("office")) intent.target = "office";
  if (text.includes("department")) intent.target = "department";

  return intent;
}

// Employee type keywords (natural language)
if (/\bcasual\b/.test(text)) {
  intent.filters.employeeType = "casual";
}

if (/\b(permanent|regular)\b/.test(text)) {
  intent.filters.employeeType = "permanent";
}

if (/\b(contract|cos)\b/.test(text)) {
  intent.filters.employeeType = "contract";
}



  /* ===============================
     FILTERS
     =============================== */

  // Gender
 if (/\b(female|women|woman|babae)\b/.test(text)) {
  intent.filters.gender = "Female";
}

if (/\b(male|men|man|lalaki)\b/.test(text)) {
  intent.filters.gender = "Male";
}


  // Age
  const above = text.match(/(above|older than)\s*(\d+)/);
  const below = text.match(/(below|younger than)\s*(\d+)/);

  if (above) intent.filters.age = { min: Number(above[2]) };
  if (below) intent.filters.age = { max: Number(below[2]) - 1 };

  // Hired time
  if (text.includes("this year")) {
    intent.filters.hired = "this_year";
  }

  if (text.includes("recent")) {
    intent.filters.hired = "recent";
  }

  /* ===============================
     FALLBACK
     =============================== */
  return intent;
}
