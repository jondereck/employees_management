import { ToolsLayout } from "@/components/layouts/tools-layout";
import HolidaysToolClient from "./HolidaysToolClient";

export default function HolidaysToolPage({
  params,
}: {
  params: { departmentId: string };
}) {
  return (
    <ToolsLayout
      params={params}
      title="Holidays"
      description="Fetch public holidays via Nager.Date (free) for PH 2026 and other supported countries."
      breadcrumbs={[{ label: "Holidays" }]}
      contentClassName="space-y-6"
    >
      <HolidaysToolClient />
    </ToolsLayout>
  );
}

