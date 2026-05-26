import { GenioContext } from "./context";
import { createGenioMetadata } from "./formatter";
import { GenioTextResult } from "./tools";
import { GenioIntentClass, LocalGenioRoute, normalizeGenioMessage } from "./router";

function textResult(reply: string, context: GenioContext): GenioTextResult {
  return { kind: "text", reply, context };
}

function isTaglish(message: string) {
  const text = normalizeGenioMessage(message);
  return /\b(ano|anong|kaya|mo|sino|ilan|mga|pwede|puwede|tulong|kumusta|kamusta)\b/.test(text);
}

export function capabilityMenu(message: string) {
  if (isTaglish(message)) {
    return `Kaya kong sumagot ng read-only HRIS questions. Halimbawa:

- List all offices
- List office heads
- Count active employees
- Search employee by name or BIO number
- Show gender, age, or tenure distribution
- Look up workforce history, awards, or employment events
- Export the last result to Excel

Hindi ako puwedeng mag-update, delete, archive, approve, or magpakita ng sensitive personal fields.`;
  }

  return `I can help with read-only HRIS questions such as:

Employees
- Count active employees
- Search employee by name, BIO number, or keyword
- List employees from a previous result

Offices
- List all offices
- List office heads
- Find who heads a specific office
- Show offices without heads

Analytics
- Gender distribution
- Age distribution
- Tenure analysis
- Top or smallest offices

History and records
- Workforce history snapshots
- Awards or recognition lookup
- Employment event lookup

Exports
- Export the last result to Excel

I cannot delete, update, archive, approve, or show sensitive personal fields.`;
}

function greeting(message: string) {
  if (isTaglish(message)) {
    return `Hi! Ako si Genio. Pwede kitang tulungan sa read-only HRIS questions tulad ng active employee count, offices, office heads, age/gender/tenure analytics, history, awards, at exports.`;
  }

  return `Hi! I am Genio. I can help with read-only HRIS questions like active employee counts, offices, office heads, age/gender/tenure analytics, history, awards, and exports.`;
}

export function unsupportedAttendanceMessage(message: string) {
  if (isTaglish(message)) {
    return "Hindi ko pa masasagot ang attendance analytics dahil wala pang attendance log model o attendance log fields sa HRIS schema. Maaari kitang tulungan sa active employees, offices, age, tenure, gender distribution, history, awards, at exports.";
  }

  return "I cannot answer attendance analytics yet because there is no attendance log model or attendance log fields in the HRIS schema. I can help with active employees, offices, age, tenure, gender distribution, history, awards, and exports.";
}

export function frontDeskResult(
  intent: GenioIntentClass,
  message: string,
  context: GenioContext
): GenioTextResult | null {
  if (intent === "small_talk") return textResult(greeting(message), context);
  if (intent === "capability_help") return textResult(capabilityMenu(message), context);
  return null;
}

export function policyResult(
  route: LocalGenioRoute,
  message: string,
  context: GenioContext
): GenioTextResult | null {
  if (route.intent !== "unsupported" || route.blockedReason !== "missing_database_field") {
    return null;
  }

  return {
    ...textResult(unsupportedAttendanceMessage(message), context),
    meta: {
      metadata: createGenioMetadata({
        tool: "not_answerable",
        selectedFields: [],
        exact: false,
      }),
    },
  };
}
