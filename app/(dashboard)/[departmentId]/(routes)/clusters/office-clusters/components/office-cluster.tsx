"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

type OfficeLite = {
  id: string;
  name: string;
  bioIndexCode: string | null;
  employeeCount?: number;
};

type OfficeCluster = {
  indexCodeKey: string;
  bioIndexCode: string | null;
  offices: OfficeLite[];
  employeeTotal?: number;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function OfficeClusters({ onlyMerged = false }: { onlyMerged?: boolean }) {
  // 1) Read param every render (unconditional hook)
  const { departmentId } = useParams() as { departmentId?: string };

  // 2) Build URL even if dept is missing; SWR will skip on null
  const minSize = onlyMerged ? 2 : 1;
  const url = departmentId
    ? `/api/${departmentId}/clusters/offices?algo=dsu&minSize=${minSize}`
    : null;

  // 3) Call SWR on every render (unconditional hook)
  const { data, error, isLoading } = useSWR(url, fetcher);

  // 4) Safe derived values (no hooks below this point)
  const clusters: OfficeCluster[] = useMemo(() => data?.data ?? [], [data]);
  const shown = data?.meta?.shownClusters ?? clusters.length;
  const total = data?.meta?.totalClusters ?? clusters.length;

  // 5) UI states
  if (!departmentId) {
    return <div className="text-sm text-muted-foreground">Loading department…</div>;
  }
  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading clusters…</div>;
  }
  if (error || !data?.ok) {
    return <div className="text-sm text-destructive">Failed to load clusters.</div>;
  }
  if (!clusters.length) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {total > 0
            ? "No merged clusters (try showing singletons)."
            : "No offices found for this department."}
        </CardContent>
      </Card>
    );
  }

  // 6) Render clusters
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {shown} of {total} clusters
        </div>
      </div>

      <Accordion type="multiple" className="space-y-3">
        {clusters.map((c) => (
          <AccordionItem key={c.indexCodeKey} value={c.indexCodeKey}>
            <Card className="overflow-hidden">
              <CardHeader className="py-4">
                <AccordionTrigger className="w-full hover:no-underline">
                  <div className="flex w-full items-center justify-between">
                    <CardTitle className="text-base font-semibold">
                      {c.bioIndexCode ?? "— No BIO Index Code —"}
                    </CardTitle>
                    <Badge variant="secondary" className="ml-3">
                      {c.offices.length} office{c.offices.length > 1 ? "s" : ""} ·{" "}
                      {c.employeeTotal ?? 0} employees
                    </Badge>
                  </div>
                </AccordionTrigger>
              </CardHeader>
              <AccordionContent>
                <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {c.offices.map((o) => (
                    <div key={o.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="truncate">
                        <div className="font-medium truncate">{o.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {o.bioIndexCode ?? "no code"}
                        </div>
                      </div>
                      <Badge>{o.employeeCount ?? 0}</Badge>
                    </div>
                  ))}
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
