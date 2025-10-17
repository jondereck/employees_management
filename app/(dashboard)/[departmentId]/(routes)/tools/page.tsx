import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import {
  Copy,
  FileSpreadsheet,
  Fingerprint,
  Image as ImageIcon,
} from "lucide-react";

import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import prismadb from "@/lib/prismadb";
import { extractToolAccess, type ToolKey } from "@/lib/tool-access";

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
];

export default async function ToolsLandingPage({
  params,
}: {
  params: { departmentId: string };
}) {
  const { departmentId } = params;
  const { userId } = auth();
  const user = await currentUser().catch(() => null);

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

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Breadcrumbs items={[{ label: "Tools" }]} />
      {cards.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.key}
                href={`/${departmentId}/${card.slug}`}
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
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          You do not have access to any tools yet.
        </p>
      )}
    </div>
  );
}
