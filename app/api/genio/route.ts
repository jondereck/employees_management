
import { parseGenioIntent } from "@/src/genio/parse-intent";


import {
  handleWhoIs,
  handleShowProfile,
  handleDistribution,
  handleInsight,
  handleCount,
  handleListOffices,
  handleWhoIsHead,
  handleIsHead,
  handleListHeads,
  handleOfficesNoHead,
  handleListFromLastCount,
  handleExport,
  handleCompareOffices,
  handleSmallestOffice,
  handleTopOffices,
  handleCompareEmployeeTypes,
  handleAgeAnalysis,
  handleTenureAnalysis,
  handleCurrentEmployeesByYear,

} from "@/src/genio/handlers";
import { streamReply } from "@/src/genio/utils";
import { handleList } from "@/src/genio/handlers/handleList";
import { handleAIAnswer } from "@/src/genio/handlers/handleAiAnswers";
import { classifyGenioIntent } from "@/src/genio/ai/classifyGenioIntent";
import { matchNLPatterns } from "@/src/genio/natural-language-map";



export async function POST(req: Request, { params }: { params: { departmentId: string } }) {
  const { message, context } = await req.json();

  const { intent, confidence } = parseGenioIntent(message, context);

if (confidence < 2) {
  const nlAction = matchNLPatterns(message);

  if (nlAction) {
    intent.action = nlAction;
  } else {
    const aiAction = await classifyGenioIntent(message);
    intent.action = aiAction;
  }
}
console.log("INTENT:", intent);

  
  switch (intent.action) {


  case "describe_employee":
  return handleWhoIs(message, context, intent);


    case "who_is_head":
      return handleWhoIsHead(message, context);

    case "is_head":
      return handleIsHead(message, context);

    case "list_heads":
      return handleListHeads(context);

    case "offices_no_head":
      return handleOfficesNoHead(context);
    case "count":
      return handleCount(intent, context, message);


    case "list":
      return handleList(context);

    case "show_profile":
      return handleShowProfile(context);

    case "distribution":
      return handleDistribution(intent, context, message);


    case "insight":
      return handleInsight(message, context);

    case "list_offices":
      return handleListOffices(context);

    case "list_from_last_count":
      return handleListFromLastCount(context);
    case "export":
      return handleExport(context);

    case "compare_offices":
      return handleCompareOffices(message, context);

    case "top_offices":
      return handleTopOffices(context);

    case "smallest_office":
      return handleSmallestOffice(context);

    case "compare_employee_types":
      return handleCompareEmployeeTypes(message, context);

    case "age_analysis":
      return handleAgeAnalysis(intent, context);

    case "tenure_analysis":
      return handleTenureAnalysis(intent, context);

      case "current_employees_by_year":
  return handleCurrentEmployeesByYear(
    intent.filters?.year,
    context
  );

    default:
      return handleAIAnswer(message, context);

  }
}
