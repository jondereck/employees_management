import dynamic from "next/dynamic";

import { Breadcrumbs } from "@/components/ui/breadcrumbs";

const CopyOptionsCard = dynamic(() => import("@/app/(dashboard)/[departmentId]/(routes)/settings/components/copy-options-card"), {
  ssr: false,
});

export default function CopyOptionsPage({
  params,
}: {
  params: { departmentId: string };
}) {
  const { departmentId } = params;
  return (
    <div className="space-y-6 p-4 md:p-6">
      <Breadcrumbs
        items={[
          { label: "Tools", href: `/${departmentId}/tools` },
          { label: "Copy Options" },
        ]}
      />
      <div className="max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold">Copy Options</h1>
        <p className="text-sm text-muted-foreground">
          Choose which fields appear when copying employee profiles and how they are formatted.
        </p>
        <CopyOptionsCard />
      </div>
    </div>
  );
}
