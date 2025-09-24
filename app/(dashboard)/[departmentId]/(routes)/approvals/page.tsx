import prismadb from "@/lib/prismadb";
import { auth, currentUser } from "@clerk/nextjs/server";
import Container from "@/app/(dashboard)/[departmentId]/(routes)/(frontend)/view/components/ui/container";
import ChangeRequestCard from "./components/change-request-card";


export const revalidate = 0;                 // no static caching
export const dynamic = "force-dynamic";      // always dynamic

async function resolveIsAdmin(departmentId: string) {
  const { userId } = auth();
  if (!userId) return false;

  const user = await currentUser().catch(() => null);
  const role = (user?.publicMetadata as any)?.role;
  if (role === "admin") return true;

  const dept = await prismadb.department.findUnique({
    where: { id: departmentId },
    select: { userId: true },
  });
  return dept?.userId === userId;
}

export default async function ApprovalsPage({
  params,
}: {
  params: { departmentId: string };
}) {
  // force fresh DB query on each request
  const { departmentId } = params;

  const isAdmin = await resolveIsAdmin(departmentId);
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-lg font-semibold">Unauthorized</h1>
        <p className="text-sm text-muted-foreground">
          You don’t have access to this page.
        </p>
      </div>
    );
  }

  // ✅ Only pull PENDING requests and include employee info for the card
  const items = await prismadb.changeRequest.findMany({
    where: { departmentId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          middleName: true,
          lastName: true,
          suffix: true,
          offices: { select: { name: true } },
        },
      },
    },
  });

  return (
    <div className="bg-white">
      <Container>
        <div className="px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-4 flex items-baseline justify-between">
            <h1 className="text-xl font-bold">Approvals</h1>
            <span className="text-xs text-muted-foreground">
              {items.length} pending
            </span>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending requests.</p>
          ) : (
            <div className="space-y-4">
              {items.map((cr) => (
                <ChangeRequestCard key={cr.id} cr={cr} departmentId={departmentId} />
              ))}
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
