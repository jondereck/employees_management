
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
} from "@/src/genio/handlers";
import { streamReply } from "@/src/genio/utils";
import { handleList } from "@/src/genio/handlers/handleList";


export async function POST(req: Request, { params }: { params: { departmentId: string } }) {
  const { message, context } = await req.json();


  if (/who is the head of/i.test(message)) {
    return handleWhoIsHead(message, context);
  }

  if (/^is .* the head of /i.test(message)) {
  return handleIsHead(message, context);
}

  // 🏢 Which offices don't have a head?
  if (/which offices.*(dont|do not).*head/i.test(message)) {
    return handleOfficesNoHead(context);
  }

  // 🧑‍💼 List all office heads
  if (/list all office heads/i.test(message)) {
    return handleListHeads(context);
  }


  const intent = await parseGenioIntent(message, context);
  switch (intent.action) {
    case "describe_employee":
      return handleWhoIs(message, context);


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


    default:
      return streamReply(
        "I’m not sure what you want to do yet.",
        context,
        null
      );
  }
}
