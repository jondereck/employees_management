import prismadb from "@/lib/prismadb";
import { ToolsPageShell } from "@/app/tools/layout";
import { BillboardForm } from "./components/billboard-form";

const BillboardDetailsPage = async ({
  params
}: {
  params: { departmentId: string; billboardId: string }
}) => {
  const billboard = await prismadb.billboard.findUnique({
    where: {
      id: params.billboardId
    }
  });


  const heading = billboard?.label ?? "New Cover";
  const description = billboard
    ? "Update cover artwork and scheduling."
    : "Create a new cover to feature across offices.";

  return (
    <ToolsPageShell
      heading={heading}
      description={description}
      breadcrumbs={[
        { label: "Tools", href: `/${params.departmentId}/tools` },
        { label: "Covers", href: `/${params.departmentId}/tools/covers` },
        { label: heading },
      ]}
      fullWidth
      contentClassName="max-w-4xl"
    >
      <BillboardForm initialData={billboard} />
    </ToolsPageShell>
  );
}

export default BillboardDetailsPage;