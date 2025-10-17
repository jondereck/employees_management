import dynamic from "next/dynamic";

import { ToolsPageShell } from "@/app/tools/layout";

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
    <ToolsPageShell
      heading="Copy Options"
      description="Choose which fields appear when copying employee profiles and how they are formatted."
      breadcrumbs={[
        { label: "Tools", href: `/${departmentId}/tools` },
        { label: "Copy Options" },
      ]}
    >
      <div className="max-w-3xl space-y-4">
        <CopyOptionsCard />
      </div>
    </ToolsPageShell>
  );
}
