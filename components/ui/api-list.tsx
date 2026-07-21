"use client";

import { useOrigin } from "@/hooks/use-origin";
import {
  apiCardsVisibilityStore,
  shouldRenderApiCards,
} from "@/lib/api-card-visibility";
import { useParams } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { ApiAlert } from "../api-alert";

interface ApiListProps {
  entityName: string;
  entityIdName: string;
}

const ApiList = ({
  entityName,
  entityIdName
}: ApiListProps) => {
  const params = useParams();
  const origin = useOrigin();
  const visibility = useSyncExternalStore(
    apiCardsVisibilityStore.subscribe,
    apiCardsVisibilityStore.getSnapshot,
    apiCardsVisibilityStore.getServerSnapshot,
  );

  useEffect(() => {
    apiCardsVisibilityStore.initialize();
  }, []);

  const baseURL = `${origin}/api/${params.departmentId}`;

  if (!visibility.initialized) {
    return (
      <div
        aria-hidden="true"
        className="hidden h-12 animate-pulse rounded-md bg-muted/50 md:block"
      />
    );
  }

  if (!shouldRenderApiCards(visibility)) return null;

  return (
    <div className="hidden md:block">
      <ApiAlert
        title="GET"
        variant="public"
        description={`${baseURL}/${entityName}`}
      />
      <ApiAlert
        title="GET"
        variant="public"
        description={`${baseURL}/${entityName}/{${entityIdName}}`}
      />
      <ApiAlert
        title="POST"
        variant="admin"
        description={`${baseURL}/${entityName}`}
      />
      <ApiAlert
        title="PATCH"
        variant="admin"
        description={`${baseURL}/${entityName}/{${entityIdName}}`}
      />
      <ApiAlert
        title="DELETE"
        variant="admin"
        description={`${baseURL}/${entityName}/{${entityIdName}}`}
      />
    </div>
  );
};

export default ApiList;