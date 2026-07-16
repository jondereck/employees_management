import { auth, currentUser } from "@clerk/nextjs/server";
import {
  BarChart3,
  CalendarDays,
  CheckSquare,
  Copy,
  Database,
  FileSpreadsheet,
  Fingerprint,
  GraduationCap,
  Image as ImageIcon,
  GitBranch,
  History,
  LayoutGrid,
  MessageSquare,
} from "lucide-react";
import { cookies } from "next/headers";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import prismadb from "@/lib/prismadb";
import { extractToolAccess, type ToolKey } from "@/lib/tool-access";
import { ToolsLayout } from "@/components/layouts/tools-layout";
import { ToolNavigationLink } from "@/components/tools/navigation-link";
import { cn } from "@/lib/utils";

type ToolCardConfig = {
  key: ToolKey;
  label: string;
  description: string;
  slug: string;
  icon: typeof Fingerprint;
};

const TOOL_CARD_CONFIG: ToolCardConfig[] = [
  {
    key: "biometrics",
    label: "Timekeeping Analyzer",
    description: "Analyze biometric logs for tardiness, undertime, and overtime.",
    slug: "tools/biometrics",
    icon: Fingerprint,
  },
  {
    key: "covers",
    label: "Covers",
    description: "Manage lobby covers and office assignments.",
    slug: "tools/covers",
    icon: ImageIcon,
  },
  {
    key: "attendance-import",
    label: "Event Attendance Import",
    description: "Import QR-based attendance records for events and ceremonies.",
    slug: "tools/attendance-import",
    icon: FileSpreadsheet,
  },
  {
    key: "attendance-exceptions",
    label: "Attendance Exception Registry",
    description: "Annex 8-C — tardiness/undertime from PerDay, plus manual MD/FD/UA/AWOL cases.",
    slug: "tools/attendance-exceptions",
    icon: CalendarDays,
  },
  {
    key: "copy-options",
    label: "Copy Options",
    description: "Configure default formatting when copying employee info.",
    slug: "tools/copy-options",
    icon: Copy,
  },
  {
    key: "sg-range",
    label: "SG Range Analytics",
    description: "Live counts and salary totals across SG levels with filters.",
    slug: "tools/sg-range",
    icon: BarChart3,
  },
  {
    key: "workforce-history",
    label: "Workforce History",
    description: "Yearly status reports by office group and employee profile fields.",
    slug: "tools/workforce-history",
    icon: History,
  },
  {
    key: "workforce-pivot",
    label: "Workforce Pivot Table",
    description: "Use a flexible matrix pivot or a CSC-style workforce report with employee drilldown.",
    slug: "tools/workforce-pivot",
    icon: LayoutGrid,
  },
  {
    key: "training",
    label: "Learning & Development",
    description: "Import training records and generate the Annex 6-G registry and 6-H dashboard.",
    slug: "tools/training",
    icon: GraduationCap,
  },
  {
    key: "sms",
    label: "Text Blast",
    description: "Send SMS via SMSGate, Twilio, or UniSMS to selected employee contact numbers.",
    slug: "tools/sms",
    icon: MessageSquare,
  },
  {
    key: "approvals",
    label: "Approval Center",
    description: "Review and process employee data changes and requests.",
    slug: "approvals",
    icon: CheckSquare,
  },
  {
    key: "org-chart",
    label: "Org Chart Builder",
    description: "Edit & export per-office org charts",
    slug: "tools/org-chart",
    icon: GitBranch,
  },
  {
    key: "holidays",
    label: "Holidays",
    description: "View PH public holidays (e.g., 2026).",
    slug: "tools/holidays",
    icon: CalendarDays,
  },
  {
    key: "backups",
    label: "Backup & Restore",
    description: "Create local snapshots and restore this department from a ZIP backup.",
    slug: "tools/backups",
    icon: Database,
  },
];

const TOOL_SECTIONS: Array<{
  id: string;
  title: string;
  description: string;
  toolKeys: ToolKey[];
}> = [
  {
    id: "attendance",
    title: "Attendance & Timekeeping",
    description: "Biometrics, exceptions, event attendance, and holidays.",
    toolKeys: ["biometrics", "attendance-exceptions", "attendance-import", "holidays"],
  },
  {
    id: "workforce",
    title: "Workforce & Reports",
    description: "Headcount, pivots, salary-grade analytics, and org charts.",
    toolKeys: ["workforce-history", "workforce-pivot", "sg-range", "org-chart"],
  },
  {
    id: "learning",
    title: "Learning & Development",
    description: "Training registry and L&D dashboards.",
    toolKeys: ["training"],
  },
  {
    id: "comms",
    title: "Communication & Approvals",
    description: "SMS blasts and change-request approvals.",
    toolKeys: ["sms", "approvals"],
  },
  {
    id: "settings",
    title: "Settings & Utilities",
    description: "Covers, copy defaults, and department backups.",
    toolKeys: ["covers", "copy-options", "backups"],
  },
];

export default async function ToolsLandingPage({
  params,
}: {
  params: { departmentId: string };
}) {
  const { departmentId } = params;
  const { userId } = auth();
  const user = await currentUser().catch(() => null);

  const cookieStore = cookies();
  const sgRangeCookieName = `sgRangeLast_${departmentId}`;
  const sgRangeQuery = cookieStore.get(sgRangeCookieName)?.value ?? "";

  let isDepartmentOwner = false;
  if (userId) {
    const department = await prismadb.department.findUnique({
      where: { id: departmentId },
      select: { userId: true },
    });
    isDepartmentOwner = department?.userId === userId;
  }

  const metadata = (user?.publicMetadata ?? {}) as Record<string, unknown>;
  const role = typeof (metadata as any).role === "string" ? String((metadata as any).role) : undefined;
  const allowedTools = extractToolAccess({ metadata, role, isDepartmentOwner });

  const byKey = new Map(TOOL_CARD_CONFIG.map((card) => [card.key, card]));

  const sections = TOOL_SECTIONS.map((section) => ({
    ...section,
    cards: section.toolKeys
      .map((key) => byKey.get(key))
      .filter((card): card is ToolCardConfig => Boolean(card) && allowedTools.has(card!.key)),
  })).filter((section) => section.cards.length > 0);

  const hasAnyTools = sections.some((s) => s.cards.length > 0);

  return (
    <ToolsLayout
      params={params}
      title="Tools"
      description="Browse utilities by category for your department."
      breadcrumbs={[]}
      contentClassName="space-y-10"
    >
      {hasAnyTools ? (
        sections.map((section) => (
          <section key={section.id} className="space-y-4">
            <div className="space-y-1 px-1">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">{section.title}</h2>
              <p className="text-xs font-medium text-slate-500">{section.description}</p>
            </div>
            <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3")}>
              {section.cards.map((card) => {
                const Icon = card.icon;
                const href =
                  card.key === "sg-range" && sgRangeQuery
                    ? `/${departmentId}/${card.slug}?${sgRangeQuery}`
                    : `/${departmentId}/${card.slug}`;

                return (
                  <ToolNavigationLink key={card.key} href={href} className="group block outline-none">
                    <Card className="relative h-full overflow-hidden border-white/40 bg-white/30 backdrop-blur-xl rounded-[2rem] p-2 transition-all duration-500 hover:bg-white/50 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1.5 active:scale-[0.98]">
                      <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-indigo-500/5 blur-3xl transition-opacity group-hover:opacity-100" />

                      <CardHeader className="flex flex-col items-start gap-4 p-6">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-100 bg-white text-indigo-600 shadow-sm transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                          <Icon className="h-6 w-6" aria-hidden="true" />
                        </div>

                        <div className="space-y-1.5">
                          <CardTitle className="flex items-center gap-2 text-base font-black tracking-tight text-slate-800">
                            {card.label}
                            <svg
                              className="h-3 w-3 -translate-x-2 text-indigo-500 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth="3"
                            >
                              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </CardTitle>
                          <CardDescription className="line-clamp-2 text-xs font-medium leading-relaxed text-slate-500">
                            {card.description}
                          </CardDescription>
                        </div>
                      </CardHeader>

                      <div className="absolute bottom-0 left-1/2 h-[2px] w-0 -translate-x-1/2 bg-gradient-to-r from-transparent via-indigo-500 to-transparent transition-all duration-500 group-hover:w-full" />
                    </Card>
                  </ToolNavigationLink>
                );
              })}
            </div>
          </section>
        ))
      ) : (
        <div className="col-span-full flex flex-col items-center justify-center rounded-[3rem] border-2 border-dashed border-slate-200 bg-white/30 py-20 backdrop-blur-sm">
          <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Access Restricted</p>
          <p className="mt-1 text-xs text-slate-500">You do not have access to any tools yet.</p>
        </div>
      )}
    </ToolsLayout>
  );
}
