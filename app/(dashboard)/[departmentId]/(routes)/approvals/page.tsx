import prismadb from "@/lib/prismadb";
import { auth, currentUser } from "@clerk/nextjs/server";
import Container from "@/app/(dashboard)/[departmentId]/(routes)/(frontend)/view/components/ui/container";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import ChangeRequestCard from "./components/change-request-card";
import ApprovalsRealtime from "./components/approvals-realtime";


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
<div className="min-h-screen bg-[#f8fafc] bg-[radial-gradient(at_top_right,_#f1f5f9_0%,_#ffffff_100%)]">
  {/* Realtime listener remains invisible but active */}
  <ApprovalsRealtime />
  
  <Container>
    <div className="max-w-5xl mx-auto space-y-8 px-4 py-12 sm:px-6 lg:px-8">
      
      {/* Navigation Header */}
      <div className="space-y-4">
        <Breadcrumbs
          className="text-indigo-600/70 font-bold text-[10px] uppercase tracking-[0.2em]"
          items={[
            { label: "Employees", href: `/${departmentId}/employees` },
            { label: "Approvals" },
          ]}
        />
        
        <div className="flex items-end justify-between border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              Review Queue
            </h1>
            <p className="text-sm font-medium text-slate-500 mt-1">
              Validate and synchronize employee data corrections.
            </p>
          </div>
          
          <div className="flex flex-col items-end gap-1">
            <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {items.length} Pending Actions
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-[3rem] border-2 border-dashed border-slate-200 bg-white/50 backdrop-blur-sm">
          <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4 text-slate-400">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="22 4 12 14.01 9 11.01" strokeLinecap="round" strokeLinejoin="round"/>
             </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800">Inbox Cleared</h2>
          <p className="text-sm text-slate-500 font-medium">All record updates have been processed.</p>
        </div>
      ) : (
        <div className="grid gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {items.map((cr) => (
            <ChangeRequestCard 
               key={cr.id} 
               cr={cr} 
               departmentId={departmentId} 
            />
          ))}
        </div>
      )}

    </div>
  </Container>
</div>
  );
}
