import dynamic from "next/dynamic";

import { ToolsLayout } from "@/components/layouts/tools-layout";

const CopyOptionsCard = dynamic(
  () => import("@/app/(dashboard)/[departmentId]/(routes)/settings/components/copy-options-card"),
  {
    ssr: false,
  }
);

export default function CopyOptionsPage({
  params,
}: {
  params: { departmentId: string };
}) {
  return (
    <ToolsLayout
      params={params}
      title="Copy Options"
      description="Choose which fields appear when copying employee profiles and how they are formatted."
      breadcrumbs={[{ label: "Copy Options" }]}
      contentClassName="max-w-3xl space-y-4"
    >
      <CopyOptionsCard />
    </ToolsLayout>
  );
}
