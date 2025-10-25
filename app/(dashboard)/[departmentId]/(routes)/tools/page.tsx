import { auth, currentUser } from "@clerk/nextjs/server";
import {
  BarChart3,
  Copy,
  FileSpreadsheet,
  Fingerprint,
  Image as ImageIcon,
} from "lucide-react";
import { cookies } from "next/headers";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import prismadb from "@/lib/prismadb";
import { extractToolAccess, type ToolKey } from "@/lib/tool-access";
import { ToolsLayout } from "@/components/layouts/tools-layout";
import { ToolNavigationLink } from "@/components/tools/navigation-link";

const TOOL_CARD_CONFIG: Array<{
  key: ToolKey;
  label: string;
  description: string;
  slug: string;
  icon: typeof Fingerprint;
}> = [
  {
    key: "biometrics",
    label: "Biometrics Uploader",
    description: "Upload biometrics logs and export attendance summaries.",
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
    label: "CSV Attendance Import",
    description: "Normalize CSV attendance files into roster-ready sheets.",
    slug: "tools/attendance-import",
    icon: FileSpreadsheet,
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
    label: "SG Range Analytics (SG 1–33)",
    description: "Live counts and salary totals by SG range with filters",
    slug: "tools/sg-range",
    icon: BarChart3,
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

  const cards = TOOL_CARD_CONFIG.filter((card) => allowedTools.has(card.key));

  const contentClassName = cards.length
    ? "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
    : "space-y-4";

  return (
    <ToolsLayout
      params={params}
      title="Tools"
      description="Browse and launch the utilities available to your department."
      breadcrumbs={[]}
      contentClassName={contentClassName}
    >
      {cards.length > 0 ? (
        cards.map((card) => {
          const Icon = card.icon;
          const href =
            card.key === "sg-range" && sgRangeQuery
              ? `/${departmentId}/${card.slug}?${sgRangeQuery}`
              : `/${departmentId}/${card.slug}`;

          return (
            <ToolNavigationLink
              key={card.key}
              href={href}
              className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <Card className="h-full transition-shadow group-hover:shadow-md">
                <CardHeader className="flex gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <CardTitle className="text-lg">{card.label}</CardTitle>
                    <CardDescription>{card.description}</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </ToolNavigationLink>
          );
        })
      ) : (
        <p className="text-sm text-muted-foreground">
          You do not have access to any tools yet.
        </p>
      )}
    </ToolsLayout>
  );
}
