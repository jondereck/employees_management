import prismadb from "@/lib/prismadb";
import getChangeRequests from "./actions/get-change-requests";
import ChangeRequestCard from "./components/change-request-card";
import { auth, currentUser } from "@clerk/nextjs/server";
import Container from "@/app/(dashboard)/[departmentId]/(routes)/(frontend)/view/components/ui/container";

async function resolveIsAdmin(departmentId: string) {
  const { userId } = auth();
  if (!userId) return false;

  const user = await currentUser().catch(() => null);
  const role = (user?.publicMetadata as any)?.role;
  if (role === "admin") return true;

  const dept = await prismadb.department.findUnique({ where: { id: departmentId }, select: { userId: true } });
  return dept?.userId === userId;
}

export default async function ApprovalsPage({ params }: { params: { departmentId: string } }) {
  const { departmentId } = params;
  const isAdmin = await resolveIsAdmin(departmentId);
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-lg font-semibold">Unauthorized</h1>
        <p className="text-sm text-muted-foreground">You don’t have access to this page.</p>
      </div>
    );
  }

  const items = await getChangeRequests(departmentId);

  return (
    <div className="bg-white">
      <Container>
        <div className="px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="text-xl font-bold mb-4">Approvals</h1>
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