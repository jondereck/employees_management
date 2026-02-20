"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Cake, Calendar, CheckCircle, FileCheck, History } from "lucide-react";

import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"
import Modal from "@/components/ui/modal";
import NotificationBell from "./notification-bell";
import usePreviewModal from "../../(frontend)/view/hooks/use-preview-modal";
import { EmployeesColumn } from "./columns";
import { Button } from "@/components/ui/button";
import { TodaysBirthdays } from "./notification/today-birthdays";
import { UpcomingBirthdays } from "./notification/upcoming-birthday";

import { useApprovalToast } from "@/hooks/use-approval-toast";
import { useParams, usePathname } from "next/navigation";
import { toast } from "sonner";
import { useApprovalsRealtime } from "@/hooks/use-approvals-realtime";
import { ApprovalEvent } from "@/lib/types/realtime";
import { useApprovalsIndicator } from "@/hooks/use-approvals-indicator";
import ApprovalsRealtimeTab from "./notification/approval-realtime-notification-tab";
import { hasBirthdayDotForToday, useBirthdayIndicator } from "@/hooks/use-birthday-indicator";



interface NotificationsProps {
  data: EmployeesColumn[];
}
const Notifications = ({ data }: NotificationsProps) => {
  const today = useMemo(() => new Date(), []);
  const params = useParams<{ departmentId: string }>();
  const pathname = usePathname();



  const departmentId =
    typeof params?.departmentId === "string"
      ? params.departmentId
      : Array.isArray(params?.departmentId)
        ? params.departmentId[0]
        : pathname?.match(/^\/([^/]+)/)?.[1] ?? "";

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const { hasApprovalDot, markApprovalsSeen } = useApprovalsIndicator();
  const { dismissedDate, markTodaySeen } = useBirthdayIndicator() as any;

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const [isNotification, setNotification] = useState(true);
  const { push, unseenCount, lastEvents, markSeen } = useApprovalToast();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const closeModal = () => setIsModalOpen(false);

  const celebrantsToday = useMemo(() => {
    const todayMonthDay = `${today.getMonth() + 1}-${today.getDate()}`;
    return data.filter((emp) => {
      if (!emp.birthday) return false;
      const dob = new Date(emp.birthday);
      if (isNaN(dob.getTime())) return false;
      const empMonthDay = `${dob.getMonth() + 1}-${dob.getDate()}`;
      return empMonthDay === todayMonthDay && !emp.isArchived;
    });
  }, [data, today]);



  const upcomingBirthdays = useMemo(() => {
    return data.filter((employee) => {
      if (!employee.birthday || employee.isArchived) return false;
      const birthday = new Date(employee.birthday);
      const thisYearBirthday = new Date(
        today.getFullYear(),
        birthday.getMonth(),
        birthday.getDate()
      );
      if (thisYearBirthday < today) {
        thisYearBirthday.setFullYear(today.getFullYear());
      }
      const diffTime = thisYearBirthday.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 && diffDays <= 7;
    });
  }, [data, today]);

  // ----- Realtime Approvals subscription -----
  const onApprovalEvent = useCallback((e: ApprovalEvent) => {
    push(e);
    toast(
      e.type === "created"
        ? `New ${e.entity} approval created`
        : `${e.entity} approval updated`,
      {
        description:
          e.title
            ? `${e.title} • ${new Date(e.when).toLocaleString()}`
            : new Date(e.when).toLocaleString(),
        icon: <FileCheck className="w-4 h-4" />,
        action: {
          label: "Open",
          onClick: () => {
            // optional: route to your approvals page
            window.location.href = `/${e.departmentId}/approvals`;
          },
        },
        duration: 5000,
      }
    );
  }, [push]);

  useApprovalsRealtime(departmentId ?? "", onApprovalEvent);

  // Badge dot should turn on if there are birthdays today OR unseen approval events
  const hasBirthdayDot = hasBirthdayDotForToday(
    celebrantsToday.length > 0,
    dismissedDate
  );

  // bell shows red if approvals unseen OR birthdays unseen-today
  const hasDot = hasApprovalDot || hasBirthdayDot;

  // When the user switches to the Birthdays tab, clear today's birthday dot
  const handleTabChange = (val: string) => {
    if (val === "birthdays") {
      markTodaySeen();                 // clears birthday dot for today
    }
    if (val === "approvals") {
      markApprovalsSeen();             // optional: clear approvals when focused
    }
  };


  // When user opens the popover/modal, mark approvals as seen
  useEffect(() => {
    if (!isModalOpen) return;
    markSeen();
  }, [isModalOpen, markSeen]);

  // Renderer for the live “Approvals” tab
  const ApprovalsTab = (
    <div className="p-2">
      <div className="mb-2 flex items-center gap-2">
        <History className="w-5 h-5" />
        <h3 className="font-semibold">Approvals </h3>
        {unseenCount > 0 && (
          <span className="ml-auto inline-flex items-center justify-center rounded-full bg-primary/10 px-2 py-0.5 text-xs">
            {unseenCount} new
          </span>
        )}
      </div>

      {lastEvents.length === 0 ? (
        <p className="text-sm text-gray-500 text-center">No recent approval activity</p>
      ) : (
        <ul className="space-y-2 max-h-72 overflow-y-auto">
          {lastEvents.map((e, i) => (
            <li
              key={`${e.approvalId}-${i}`}
              className="flex items-start justify-between rounded-md border p-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium capitalize">
                    {e.entity} • {e.type}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1 truncate">
                  {e.title ?? e.targetId}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {new Date(e.when).toLocaleString()}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="ml-2 shrink-0"
                onClick={() => (window.location.href = `/${e.departmentId}/approvals`)}
              >
                View
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="relative flex items-center">
      {isMobile ? (
       <>
  {/* Notification Trigger Button */}
  <button 
    onClick={() => setIsModalOpen(true)}
    className="relative p-2 rounded-full transition-active active:scale-90"
  >
    <NotificationBell hasDot={hasDot} />
  </button>

  <Modal
    title="Notifications"
    description="Live approvals and birthdays"
    isOpen={isModalOpen}
    onClose={() => { setIsModalOpen(false); markApprovalsSeen(); }}
    /* Customizing the modal container to be Frosted Glass */
    className="bg-white/70 backdrop-blur-2xl border-white/40 rounded-[2.5rem] shadow-2xl"
  >
    <div className="w-full">
      <Tabs defaultValue="approvals" className="w-full" onValueChange={handleTabChange}>
        
        {/* FROSTED TAB LIST */}
        <TabsList className="grid grid-cols-2 p-1 bg-slate-200/40 backdrop-blur-md rounded-2xl border border-white/20">
          <TabsTrigger 
            value="approvals" 
            className="rounded-xl font-bold text-xs uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm"
          >
            Approvals
          </TabsTrigger>
          <TabsTrigger 
            value="birthdays" 
            className="relative rounded-xl font-bold text-xs uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-pink-600 data-[state=active]:shadow-sm"
          >
            Birthdays
            {hasBirthdayDot && (
              <span className="absolute top-1 right-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="approvals" className="mt-4 focus-visible:outline-none">
          {/* Glass Card for Approval Content */}
          <div className="rounded-3xl bg-white/40 p-1 border border-white/40">
            <ApprovalsRealtimeTab departmentId={departmentId} />
          </div>
        </TabsContent>

        <TabsContent value="birthdays" className="mt-4 space-y-4 focus-visible:outline-none">
          
          {/* TODAY'S BIRTHDAY SECTION */}
          <div className="p-4 rounded-3xl bg-gradient-to-br from-white/60 to-white/20 backdrop-blur-md border border-white/50 shadow-sm">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-3 mb-4 uppercase tracking-tighter">
              <div className="p-2 bg-yellow-100 rounded-xl">
                <Cake className="h-5 w-5 text-yellow-600" />
              </div>
              {"Today's Celebrants"}
              
            </h3>
            <TodaysBirthdays celebrantsToday={celebrantsToday} closeParentModal={closeModal} />
          </div>

          {/* UPCOMING BIRTHDAY SECTION */}
          <div className="p-4 rounded-3xl bg-white/30 backdrop-blur-sm border border-white/30">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-3 mb-4 uppercase tracking-tighter">
              <div className="p-2 bg-rose-100 rounded-xl">
                <Calendar className="h-5 w-5 text-rose-600" />
              </div>
              Upcoming (7 Days)
            </h3>
            <UpcomingBirthdays
              celebrantsUpcoming={upcomingBirthdays}
              onOpenPreview={(emp) => {
                setNotification(false);
                usePreviewModal.getState().onOpen(emp);
              }}
              closeParentModal={closeModal}
              limit={8}
            />
          </div>

        </TabsContent>
      </Tabs>
    </div>
  </Modal>
</>
      ) : (
  <Popover onOpenChange={(open) => { if (open) markApprovalsSeen(); }}>
  <PopoverTrigger asChild>
    <button className="relative p-2 rounded-full transition-all hover:bg-white/20 active:scale-95">
      <NotificationBell hasDot={hasDot} />
    </button>
  </PopoverTrigger>
  
  <PopoverContent 
    className="w-[420px] p-0 border-white/40 bg-white/70 backdrop-blur-2xl rounded-[2rem] shadow-2xl overflow-hidden mr-4 mt-2" 
    align="end"
  >
    <Tabs defaultValue="approvals" className="w-full" onValueChange={handleTabChange}>
      {/* FROSTED TAB LIST */}
      <div className="p-4 pb-2">
        <TabsList className="grid grid-cols-2 p-1 bg-slate-200/40 backdrop-blur-md rounded-2xl border border-white/20">
          <TabsTrigger 
            value="approvals" 
            className="rounded-xl font-black text-[10px] uppercase tracking-widest transition-all data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm"
          >
            Approvals
          </TabsTrigger>
          <TabsTrigger 
            value="birthdays" 
            className="relative rounded-xl font-black text-[10px] uppercase tracking-widest transition-all data-[state=active]:bg-white data-[state=active]:text-pink-600 data-[state=active]:shadow-sm"
          >
            Birthdays
            {hasBirthdayDot && (
              <span className="ml-2 inline-block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            )}
          </TabsTrigger>
        </TabsList>
      </div>

      <div className="max-h-[500px] overflow-y-auto no-scrollbar px-4 pb-6">
        <TabsContent value="approvals" className="mt-2 outline-none">
          <div className="rounded-2xl bg-white/40 p-1 border border-white/40">
            <ApprovalsRealtimeTab departmentId={departmentId} />
          </div>
        </TabsContent>

        <TabsContent value="birthdays" className="mt-2 space-y-6 outline-none">
          {/* Today's Birthdays Section */}
          <div className="p-4 rounded-3xl bg-gradient-to-br from-white/60 to-white/20 backdrop-blur-md border border-white/50 shadow-sm">
            <h3 className="text-[11px] font-black text-slate-800 flex items-center gap-3 mb-4 uppercase tracking-tighter">
              <div className="p-2 bg-yellow-100/80 rounded-xl shadow-inner">
                <Cake className="h-4 w-4 text-yellow-600" />
              </div>
              Today's Celebrants
              {"Today's Celebrants"}
            </h3>
            <TodaysBirthdays celebrantsToday={celebrantsToday} closeParentModal={() => { }} />
          </div>

          {/* Upcoming Birthdays Section */}
          <div className="p-4 rounded-3xl bg-white/30 backdrop-blur-sm border border-white/30">
            <h3 className="text-[11px] font-black text-slate-800 flex items-center gap-3 mb-4 uppercase tracking-tighter">
              <div className="p-2 bg-rose-100/80 rounded-xl shadow-inner">
                <Calendar className="h-4 w-4 text-rose-600" />
              </div>
              Upcoming (7 Days)
            </h3>
            <UpcomingBirthdays
              celebrantsUpcoming={upcomingBirthdays}
              onOpenPreview={(emp) => {
                setNotification(false);
                usePreviewModal.getState().onOpen(emp);
              }}
              limit={5}
            />
          </div>
        </TabsContent>
      </div>
    </Tabs>
  </PopoverContent>
</Popover>

      )
      }
    </div>
  );
};

export default Notifications;
