"use client";

import { useEffect, useSyncExternalStore } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { apiCardsVisibilityStore } from "@/lib/api-card-visibility";

export function ApiCardVisibilitySetting() {
  const visibility = useSyncExternalStore(
    apiCardsVisibilityStore.subscribe,
    apiCardsVisibilityStore.getSnapshot,
    apiCardsVisibilityStore.getServerSnapshot
  );

  useEffect(() => {
    apiCardsVisibilityStore.initialize();
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">API request cards</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-6">
        <div>
          <label htmlFor="show-api-request-cards" className="font-medium">
            Show API request cards
          </label>
          <p className="text-sm text-muted-foreground">
            Display GET, POST, PATCH, and DELETE reference cards on management
            pages.
          </p>
        </div>
        <Switch
          id="show-api-request-cards"
          checked={visibility.visible}
          disabled={!visibility.initialized}
          onCheckedChange={apiCardsVisibilityStore.setVisibility}
          aria-label="Show API request cards"
        />
      </CardContent>
    </Card>
  );
}
