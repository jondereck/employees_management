"use client";

import axios from "axios";
import { useEffect } from "react";
import useSWR, { mutate as mutateSWR } from "swr";

import type {
  OfficeWorkforceMetrics,
  OfficeWorkforceRow,
  WorkforceDetailsView,
} from "@/lib/office-workforce";
import type { AuthorizedPositionSummaryRow } from "@/lib/office-workforce-position-summary";
import {
  isOfficeWorkforceDetailsKey,
  officeWorkforceDetailsKey,
  officeWorkforceSummaryKey,
} from "@/lib/office-workforce-swr";
import { pusherClient } from "@/lib/pusher-client";
import {
  WORKFORCE_CHANGED_EVENT,
  type WorkforceChangedPayload,
  isWorkforceChangedPayload,
  workforceChannel,
} from "@/lib/workforce-realtime-contract";

export {
  isOfficeWorkforceDetailsKey,
  officeWorkforceDetailsKey,
  officeWorkforceSummaryKey,
};

export type OfficeWorkforceSummaryResponse = {
  overall: OfficeWorkforceMetrics;
  perOffice: OfficeWorkforceRow[];
  positionSummary: AuthorizedPositionSummaryRow[];
};

export type VacantWorkforceDetail = {
  kind: "vacant";
  plantillaPositionId: string;
  title: string;
  itemNumber: string | null;
  salaryGrade: number | null;
  division: { id: string; name: string } | null;
  employeeType: { id: string; name: string } | null;
};

export type EmployeeWorkforceDetail = {
  kind: "employee";
  employeeId: string;
  name: string;
  position: string;
  assignedOffice: { id: string; name: string };
  plantillaOffice: { id: string; name: string } | null;
};

export type OfficeWorkforceDetailsResponse = {
  view: WorkforceDetailsView;
  office: { id: string; name: string };
  items: Array<VacantWorkforceDetail | EmployeeWorkforceDetail>;
};

type Subscription = {
  references: number;
  handler: (payload: WorkforceChangedPayload) => void;
};

const subscriptions = new Map<string, Subscription>();
const REFRESH_INTERVAL_MS = 60_000;
const fetcher = <T,>(url: string) => axios.get<T>(url).then((response) => response.data);

function invalidateOfficeWorkforce(departmentId: string) {
  void mutateSWR(officeWorkforceSummaryKey(departmentId));
  void mutateSWR(
    (key) => isOfficeWorkforceDetailsKey(key, departmentId),
    undefined,
    { revalidate: true }
  );
}

function retainWorkforceSubscription(departmentId: string) {
  const existing = subscriptions.get(departmentId);
  if (existing) {
    existing.references += 1;
    return;
  }

  const channelName = workforceChannel(departmentId);
  const channel = pusherClient.subscribe(channelName);
  const handler = (payload: WorkforceChangedPayload) => {
    if (isWorkforceChangedPayload(payload)) {
      invalidateOfficeWorkforce(departmentId);
    }
  };

  channel.bind(WORKFORCE_CHANGED_EVENT, handler);
  subscriptions.set(departmentId, { references: 1, handler });
}

function releaseWorkforceSubscription(departmentId: string) {
  const subscription = subscriptions.get(departmentId);
  if (!subscription) return;

  subscription.references -= 1;
  if (subscription.references > 0) return;

  const channelName = workforceChannel(departmentId);
  const channel = pusherClient.channel(channelName);
  channel?.unbind(WORKFORCE_CHANGED_EVENT, subscription.handler);
  pusherClient.unsubscribe(channelName);
  subscriptions.delete(departmentId);
}

export function useOfficeWorkforceRealtime(departmentId: string) {
  useEffect(() => {
    if (!departmentId) return;

    retainWorkforceSubscription(departmentId);
    return () => releaseWorkforceSubscription(departmentId);
  }, [departmentId]);
}

export function useOfficeWorkforceSummary(departmentId: string) {
  useOfficeWorkforceRealtime(departmentId);
  return useSWR<OfficeWorkforceSummaryResponse>(
    departmentId ? officeWorkforceSummaryKey(departmentId) : null,
    fetcher,
    { refreshInterval: REFRESH_INTERVAL_MS }
  );
}

export function useOfficeWorkforceDetails(
  departmentId: string,
  officeId: string,
  view: WorkforceDetailsView | null
) {
  useOfficeWorkforceRealtime(departmentId);
  return useSWR<OfficeWorkforceDetailsResponse>(
    departmentId && officeId && view
      ? officeWorkforceDetailsKey(departmentId, officeId, view)
      : null,
    fetcher,
    { refreshInterval: REFRESH_INTERVAL_MS }
  );
}
