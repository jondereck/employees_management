"use client";

import { usePathname, useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Menu,
  Users,
  Settings,
  BadgeCheck,
  Briefcase,
  LayoutDashboard,
  ShieldCheck,
  Building,
  UserCheck2,
  Fingerprint,
  Image as ImageIcon,
  FileSpreadsheet,
  Copy,
  Cake,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Loading from "@/app/loading";
import { extractToolAccess, type ToolKey } from "@/lib/tool-access";

type NavItem = {
  label: string;
  path: string;
  icon?: React.ElementType;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const TOOL_NAV_MAP: Record<ToolKey, NavItem> = {
  biometrics: {
    label: "Biometrics Uploader",
    path: "tools/biometrics",
    icon: Fingerprint,
  },
  covers: {
    label: "Covers",
    path: "tools/covers",
    icon: ImageIcon,
  },
  "attendance-import": {
    label: "CSV Attendance Import",
    path: "tools/attendance-import",
    icon: FileSpreadsheet,
  },
  "copy-options": {
    label: "Copy Options",
    path: "tools/copy-options",
    icon: Copy,
  },
};

export default function MobileSidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const params = useParams();
  const [loading, setLoading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const router = useRouter();
  const { user } = useUser();

  const metadata = (user?.publicMetadata ?? {}) as Record<string, unknown>;
  const role = typeof (metadata as any).role === "string" ? String((metadata as any).role) : undefined;
  const permittedTools = Array.from(extractToolAccess({ metadata, role })).map((key) => TOOL_NAV_MAP[key]);
  const toolItems: NavItem[] = [
    {
      label: "Tools Home",
      path: "tools",
      icon: Wrench,
    },
    ...permittedTools,
  ];

  useEffect(() => {
    setLoading(false);
  }, [pathname]);

  const handleLinkClick = (href: string) => {
    if (href !== pathname) {
      setLoading(true);
      setSheetOpen(false);
      router.push(href);
    }
  };

  const getHref = (path: string) => {
    const normalized = path.startsWith("/") ? path.slice(1) : path;
    return `/${params.departmentId}${normalized ? `/${normalized}` : ""}`;
  };

  const navGroups: NavGroup[] = [
    {
      title: "Main",
      items: [
        {
          label: "Overview",
          path: ``,
          icon: LayoutDashboard,
        },
        {
          label: "Offices",
          path: `offices`,
          icon: Building,
        },
      ],
    },
    {
      title: "Employees",
      items: [
        {
          label: "Manage Employees",
          path: `employees`,
          icon: Users,
        },
        {
          label: "Approvals",
          path: `approvals`,
          icon: BadgeCheck,
        },
        {
          label: "Birthdays",
          path: `birthdays`,
          icon: Cake,
        },
        {
          label: "View Employees",
          path: `view`,
          icon: UserCheck2,
        },
        {
          label: "Appointment",
          path: `employee_type`,
          icon: Briefcase,
        },
        {
          label: "Eligibility",
          path: `eligibility`,
          icon: ShieldCheck,
        },
      ],
    },
  ];

  if (toolItems.length > 0) {
    navGroups.push({ title: "Tools", items: toolItems });
  }

  navGroups.push({
    title: "Settings",
    items: [
      {
        label: "Settings",
        path: `settings`,
        icon: Settings,
      },
    ],
  });


  return (
    <>

      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-black/80">
          <Loading />
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSheetOpen(true)}>
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>

        <SheetContent side="left" className="p-4 w-72 sm:w-80">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold"></SheetTitle>
          </SheetHeader>

          <nav className="mt-6 space-y-4">
            {navGroups.map((group, index) => (
              <Accordion
                key={group.title}
                type="single"
                collapsible
                defaultValue={index === 0 ? group.title : undefined}
              >
                <AccordionItem value={group.title}>
                  <AccordionTrigger className="text-sm font-medium text-muted-foreground">
                    {group.title}
                  </AccordionTrigger>
                  <AccordionContent className="pl-2">
                    <ul className="space-y-1" >
                      {group.items.map(({ label, path, icon: Icon }) => {
                        const href = getHref(path);
                        const isActive = pathname === href;

                        return (
                          <li key={label}>
                            <button
                              disabled={loading} // disable during global loading
                              onClick={() => handleLinkClick(href)}
                              className={cn(
                                "flex items-center gap-2 rounded px-2 py-2 text-sm w-full text-left transition-colors",
                                isActive
                                  ? "bg-green-100 text-green-700 font-semibold"
                                  : "text-muted-foreground hover:bg-muted",
                                loading && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              {Icon && <Icon className="h-4 w-4" />}
                              <span>{label}</span>
                             
                            </button>
                          </li>
                        );
                      })}

                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

    </>

  );
}
