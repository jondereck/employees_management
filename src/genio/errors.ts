import { GENIO_DB_BACKED_SUGGESTIONS } from "./capabilities";

export type GenioNotAnswerableReason =
  | "missing_database_field"
  | "write_action_not_allowed"
  | "outside_hrps_scope"
  | "ambiguous_question"
  | "sensitive_data_restricted";

export function notAnswerableMessage({
  reason,
  missingData,
}: {
  reason: GenioNotAnswerableReason;
  missingData?: string;
}) {
  if (reason === "write_action_not_allowed") {
    return "Read-only ako sa HRPS. Hindi ako puwedeng mag-create, update, delete, archive, approve, reject, or magpalit ng employee records.";
  }

  if (reason === "sensitive_data_restricted") {
    return "Hindi ko puwedeng ilabas ang sensitive personal identifiers or private contact details sa Genio chat.";
  }

  if (reason === "ambiguous_question") {
    return "Kailangan ko ng mas malinaw na HRPS database question para masagot ito nang tama.";
  }

  const detail = missingData ? ` dahil wala akong ${missingData} sa current schema` : "";
  return `Hindi ko masasagot iyan from the HRPS database ngayon${detail}. Pwede kitang tulungan sa: ${GENIO_DB_BACKED_SUGGESTIONS.join(", ")}.`;
}
