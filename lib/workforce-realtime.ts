import { pusherServer } from "@/lib/pusher";
import {
  type WorkforceChangedPayload,
  triggerWorkforceChangedBestEffort,
} from "@/lib/workforce-realtime-contract";

export async function publishWorkforceChanged(
  departmentId: string,
  payload: WorkforceChangedPayload
) {
  await triggerWorkforceChangedBestEffort(
    (channel, event, data) => pusherServer.trigger(channel, event, data),
    departmentId,
    payload,
    (error) => console.error("[WORKFORCE_REALTIME_PUBLISH]", error)
  );
}
