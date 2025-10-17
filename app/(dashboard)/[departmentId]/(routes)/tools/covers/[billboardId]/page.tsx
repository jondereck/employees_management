import prismadb from "@/lib/prismadb";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
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


  return (
    <div className="flex-col">
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <Breadcrumbs
          items={[
            { label: "Tools", href: `/${params.departmentId}/tools` },
            { label: "Covers", href: `/${params.departmentId}/tools/covers` },
            { label: billboard?.label ?? "New Cover" }
          ]}
        />
        <BillboardForm initialData={billboard} />
      </div>
    </div>
  );
}

export default BillboardDetailsPage;