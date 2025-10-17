import prismadb from "@/lib/prismadb";

import { ToolsLayout } from "@/app/tools/layout";
import { BillboardForm } from "./components/billboard-form";

const BillboardDetailsPage = async ({
  params,
}: {
  params: { departmentId: string; billboardId: string };
}) => {
  const billboard = await prismadb.billboard.findUnique({
    where: {
      id: params.billboardId,
    },
  });

  return (
    <ToolsLayout
      params={params}
      title={billboard?.label ?? "New Cover"}
      description={billboard ? "Update cover details and assignments." : "Create a new cover and assign it across offices."}
      breadcrumbs={[
        { label: "Covers", href: `/${params.departmentId}/tools/covers` },
        { label: billboard?.label ?? "New Cover" },
      ]}
      contentClassName="max-w-4xl space-y-6"
    >
      <BillboardForm initialData={billboard} />
    </ToolsLayout>
  );
};

export default BillboardDetailsPage;
