export const WORKFORCE_CHANGED_EVENT = "workforce:changed" as const;

export const WORKFORCE_CHANGE_SCOPES = [
  "employee",
  "office",
  "plantilla",
] as const;

export const WORKFORCE_CHANGE_ACTIONS = [
  "created",
  "updated",
  "deleted",
  "archived",
  "unarchived",
  "bulk-archived",
  "bulk-unarchived",
  "linked",
  "unlinked",
] as const;

export type WorkforceChangeScope = (typeof WORKFORCE_CHANGE_SCOPES)[number];
export type WorkforceChangeAction = (typeof WORKFORCE_CHANGE_ACTIONS)[number];

export type WorkforceChangedPayload = {
  scope: WorkforceChangeScope;
  action: WorkforceChangeAction;
};

export function workforceChannel(departmentId: string) {
  return `dept-${departmentId}-workforce`;
}

export function isWorkforceChangedPayload(
  value: unknown
): value is WorkforceChangedPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const payload = value as Record<string, unknown>;
  const keys = Object.keys(payload);
  return (
    keys.length === 2 &&
    keys.includes("scope") &&
    keys.includes("action") &&
    WORKFORCE_CHANGE_SCOPES.includes(payload.scope as WorkforceChangeScope) &&
    WORKFORCE_CHANGE_ACTIONS.includes(payload.action as WorkforceChangeAction)
  );
}

export async function triggerWorkforceChangedBestEffort(
  trigger: (
    channel: string,
    event: typeof WORKFORCE_CHANGED_EVENT,
    payload: WorkforceChangedPayload
  ) => Promise<unknown>,
  departmentId: string,
  payload: WorkforceChangedPayload,
  onError: (error: unknown) => void = console.error
) {
  if (!departmentId || !isWorkforceChangedPayload(payload)) return;

  try {
    await trigger(workforceChannel(departmentId), WORKFORCE_CHANGED_EVENT, payload);
  } catch (error) {
    onError(error);
  }
}
