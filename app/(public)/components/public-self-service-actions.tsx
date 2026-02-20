"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Landmark, Calendar, Download, FileText, Wrench, GraduationCap, HeartHandshake, Fingerprint, RotateCcw, PhoneCall } from "lucide-react";
import { IdCardIcon } from "@radix-ui/react-icons";
import { PreActionGuard } from "@/components/ui/pre-action-guard";
import PdfViewerTile from "./pdf-viewer-tile";
import SimplePdfViewerTile from "./pdf-viewer-tile";
import { HotlineDirectory } from "./hotline";
import { LINGAYEN_HOTLINES } from "./lingayen-hotline/data";
import SimplePdfLinkTile from "./pdf-viewer-tile";
import { FloatingShortcuts } from "./modals/floating-shorcuts";
import MobileBirthdayGreeter from "./mobile-bday-greeter";
import { cn } from "@/lib/utils";


type Props = {
  employeeId: string;
  employeeType?: string | null;  
  isActive?: boolean;
  leaveFormUrl?: string;
  forms?: Array<{ label: string; href: string }>;
  trainingCalendarUrl?: string;          // e.g. "/files/TrainingCalendar.pdf" or external link
  trainingNominationFormUrl?: string; biometricsFolderUrl?: string;
    birthdayPeople?: Array<{
    id: string;
    firstName: string;
    lastName?: string | null;
    nickname?: string | null;
    imageUrl?: string | null;
    prefix?: string | null;
    middleName?: string | null;
    suffix?: string | null;
    birthday: string; // ISO

  }>;
       birthdayMonthOverride?: number;

  // Optional: background image for the birthday card
  birthdayBackgroundSrc?: string;

};

function norm(t?: string | null) {
  return (t ?? "").trim().toLowerCase();
}

// Permanent/Casual/Co-terminous -> SR ; others -> COE
function getPrimaryDocForType(employeeType?: string | null) {
  const t = norm(employeeType);
  const isSR =
    t === "permanent" ||
    t === "casual" ||
    t === "co-terminous" ||
    t === "co terminous" ||
    t === "co-terminus" ||
    t === "coterminous";
  return isSR
    ? { key: "sr" as const, title: "Request Service Record", btn: "Request SR", icon: Landmark }
    : { key: "coe" as const, title: "Request Certificate of Employment", btn: "Request COE", icon: IdCardIcon };


}




export default function PublicSelfServiceActions({
  employeeId,
  employeeType,
   isActive = false,
  leaveFormUrl = "/files/CSForm6_LeaveApplication.pdf",
  forms = [
    { label: "Leave Application (CS Form 6)", href: "/files/CSForm6_LeaveApplication.pdf" },
    { label: "PDS Update Form", href: "/files/PDS_Update_Form.pdf" },
    { label: "DTR Template", href: "/files/DTR_Template.xlsx" },
    { label: "SALN Form", href: "/files/SALN_Form.pdf" },
  ],
  trainingCalendarUrl = "/files/TrainingCalendar.pdf",
  trainingNominationFormUrl,
  biometricsFolderUrl,
    birthdayPeople = [],
  birthdayMonthOverride,
  birthdayBackgroundSrc = "/individual-bday-greet.png", // or "/bday_bg.png"
}: Props) {
  const [docOpen, setDocOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [trainingOpen, setTrainingOpen] = useState(false);
  const [bioGuideOpen, setBioGuideOpen] = useState(false);


  const primary = useMemo(() => getPrimaryDocForType(employeeType), [employeeType]);
  const PrimaryIcon = primary.icon;


  // ADD: show leave only for Permanent, Co-terminous, Casual
  const canFileLeave = useMemo(() => {
    const t = (employeeType ?? "").trim().toLowerCase();
    return (
      t === "permanent" ||
      t === "casual" ||
      t === "co-terminous" ||
      t === "co terminous" ||
      t === "co-terminus" ||
      t === "coterminous"
    );
  }, [employeeType]);

  // Extract folderId from a Drive folder URL
  function getFolderId(url?: string) {
    if (!url) return null;
    const m = url.match(/\/folders\/([^/?#]+)/);
    if (m?.[1]) return m[1];
    try { return new URL(url).searchParams.get("id"); } catch { return null; }
  }

  // PH formatter
  const fmtPH = (d?: string | Date | null) =>
    d ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" })
      .format(new Date(d)) : "";

  // Biometrics fetch state
  const [bioLoading, setBioLoading] = useState(false);
  const [bioError, setBioError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [latestFile, setLatestFile] = useState<{ id: string; name?: string | null } | null>(null);

  // fetcher
  async function fetchBiometricsMeta(folderUrl?: string) {
    if (!folderUrl) return;
    const folderId = getFolderId(folderUrl);
    if (!folderId) return;

    setBioLoading(true);
    setBioError(null);
    try {
      const r = await fetch(`/api/biometrics/last-updated?folderId=${folderId}`, { cache: "no-store" });
      const data = await r.json();
      if (!data?.ok) throw new Error(data?.error || "Failed to read Drive");
      setLastUpdated(data.lastUpdated ?? null);
      setLatestFile(data.latestFile ?? null);
    } catch (e: any) {
      setBioError(e?.message ?? "Drive error");
    } finally {
      setBioLoading(false);
    }
  }

  // auto on mount / when URL changes
  useEffect(() => {
    fetchBiometricsMeta(biometricsFolderUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biometricsFolderUrl]);


  return (
    <div className="space-y-6">
      {/* === Birthday Celebrants (Mobile-friendly) === */}
{birthdayPeople.length > 0 && (
  <section id="birthdays" className="mb-6">
    <MobileBirthdayGreeter
      people={birthdayPeople}
      monthOverride={birthdayMonthOverride}
      backgroundSrc={birthdayBackgroundSrc}
    />
  </section>
)}

      {/* Resources */}

        {!isActive && (
  <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Resources</h2>
          <span className="text-xs text-muted-foreground">Read & download</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 items-start"> {/* <- not items-stretch */}
          {/* <SimplePdfLinkTile
            title="Employee Handbook"
            description="A complete guide to workplace policies, employee benefits, and standards."
            pdfUrl="/_pdf/employee-handbook.pdf"
            watermarkText="Municipality of Lingayen"
            watermarkImageUrl="/logo.png"
            downloadFileName="employee-handbook"
            wmSize={200}
            wmOpacity={0.12}
            wmRotationDeg={0}

          /> */}
          <SimplePdfLinkTile
            title="Citizen's Charter"
            description="A transparent guide to frontline services, processes, and commitments under the ARTA framework."
            pdfUrl="/_pdf/ARTA.pdf"
            watermarkText="Municipality of Lingayen"
            watermarkImageUrl="/logo.png"
            downloadFileName="Citizen's-Charter"
            wmSize={200}
            wmOpacity={0.12}
            wmRotationDeg={0}

          />

            <SimplePdfLinkTile
            title="Panunumpa ng Lingkod Bayan"
            description="A formal oath expressing the values, responsibilities, and ethical standards expected of every public servant."
            pdfUrl="/_pdf/panunumpa.pdf"
            watermarkText="Municipality of Lingayen"
            watermarkImageUrl="/logo.png"
            downloadFileName="Panunumpa-ng-Lingkod-Bayan"
            wmSize={200}
            wmOpacity={0.12}
            wmRotationDeg={0}

          />
        </div>
      </section>
  )}
     
     <section>
  <TooltipProvider delayDuration={200}>
    {/* Main Container: High-Depth Glass Card */}
    <Card className="rounded-[2.5rem] border-white/40 bg-white/30 backdrop-blur-2xl shadow-2xl overflow-hidden transition-all duration-500">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6 border-b border-white/20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/30">
            <Wrench className="h-5 w-5 text-white" />
          </div>
          <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-800">
            Self-Service
          </CardTitle>
        </div>
        <Badge 
          variant="secondary" 
          className="gap-1.5 bg-white/50 text-slate-600 border-white/60 px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
          </span>
          Ongoing
        </Badge>
      </CardHeader>

 

      <CardContent className="grid gap-6 p-6 sm:grid-cols-2 lg:grid-cols-3">
        
        {/* 1. BIOMETRICS LOGS TILE */}
        {!isActive && biometricsFolderUrl && (
          <div className="group relative flex flex-col rounded-[2rem] border border-white/40 bg-white/40 p-5 shadow-sm transition-all hover:bg-white/60 hover:shadow-xl hover:-translate-y-1">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 shadow-inner">
                <Fingerprint className="h-6 w-6" />
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-xl hover:bg-indigo-100"
                onClick={() => fetchBiometricsMeta(biometricsFolderUrl)}
                disabled={bioLoading}
              >
                <RotateCcw className={`h-4 w-4 text-indigo-600 ${bioLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>

            <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm mb-1">Biometrics Logs</h3>
            <p className="text-[11px] font-medium text-slate-500 leading-relaxed mb-4">
              Access monthly attendance files via Drive. Match your BIO Group and sync anytime.
            </p>

            <div className="mt-auto flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="flex-1 rounded-xl bg-slate-900/5 text-slate-600 font-bold text-[10px] uppercase tracking-wider hover:bg-slate-900/10"
                onClick={() => setBioGuideOpen(true)}
              >
                Guide
              </Button>
              <PreActionGuard
                storageKey="biometrics_warn"
                policyId="2025-09"
                href={biometricsFolderUrl}
                newTab
                title="Before you open Biometrics"
                subtitle="Google Drive → Biometrics"
                description="To ensure proper use:"
                bullets={[
                  <>Use only files for your <strong>office/BIO group</strong>.</>,
                  <>Verify your <strong>Employee No.</strong> on your profile.</>,
                  <>Match <strong>BIO Group</strong> and <strong>Index Code</strong>.</>,
                  <>Misuse may lead to administrative action.</>,
                ]}
                buttonText="Open Drive"
                buttonIconLeft={<Download className="h-4 w-4" />}
                buttonProps={{ 
                  size: "sm", 
                  className: "flex-[2] rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 font-black text-[10px] uppercase tracking-widest" 
                }}
              />
            </div>
            
            <div className="mt-3 flex items-center gap-1.5 px-1">
               <div className={cn("h-1.5 w-1.5 rounded-full", lastUpdated ? "bg-emerald-500" : "bg-slate-300")} />
               <span className="text-[10px] font-black uppercase tracking-tighter text-slate-400">
                 {bioLoading ? "Syncing..." : lastUpdated ? `Last Update: ${fmtPH(lastUpdated)}` : bioError ? "Error Loading" : "No files detected"}
               </span>
            </div>
          </div>
        )}

        {/* 2. DOWNLOADABLE FORMS TILE */}
        <div  className="group relative flex flex-col rounded-[2rem] border border-white/40 bg-white/40 p-5 shadow-sm transition-all hover:bg-white/60 hover:shadow-xl hover:-translate-y-1">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 shadow-inner">
            <FileText className="h-6 w-6" />
          </div>
          <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm mb-3">Downloadable Forms</h3>
          
          <div className="space-y-2 flex-grow">
            {forms.map((f) => (
              <div key={f.label} className="flex items-center justify-between p-2 rounded-xl bg-white/30 border border-white/20">
                <span className="text-[11px] font-bold text-slate-600 truncate max-w-[180px]">{f.label}</span>
                <a href={f.href} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg hover:bg-amber-100 text-amber-600">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* 3. PRIMARY ACTION (COE/SR) TILE */}
        <div  className="group relative flex flex-col rounded-[2rem] border border-white/40 bg-white/40 p-5 shadow-sm transition-all hover:bg-white/60 hover:shadow-xl hover:-translate-y-1">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600 shadow-inner">
              <PrimaryIcon className="h-6 w-6" />
            </div>
            <Badge className="bg-violet-100 text-violet-600 border-none font-black text-[9px] uppercase">Ongoing</Badge>
          </div>
          <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm mb-1">{primary.title}</h3>
          <p className="text-[11px] font-medium text-slate-500 leading-relaxed mb-4 flex-grow">
            {primary.key === "sr"
              ? "Available for Permanent, Co-terminous, and Casual employees."
              : "Submit a COE request. Processing and release by HRMO."}
          </p>
          <Button 
            size="sm" 
            className="w-full rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-500/20 font-black text-[10px] uppercase tracking-widest"
            onClick={() => setDocOpen(true)}
          >
            {primary.btn}
          </Button>
        </div>

        {/* 4. LEAVE TILE */}
        {canFileLeave && (
          <div className="flex flex-col rounded-[2rem] border border-white/40 bg-white/40 p-5 shadow-sm transition-all hover:bg-white/60">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 shadow-inner">
              <Calendar className="h-6 w-6" />
            </div>
            <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm mb-1">File a Leave</h3>
            <p className="text-[11px] font-medium text-slate-500 leading-relaxed mb-4">
              Download form and submit to your Office HR Focal.
            </p>
            <div className="mt-auto flex gap-2">
              <Button size="sm" variant="ghost" className="flex-1 rounded-xl bg-slate-900/5 text-slate-600 font-bold text-[10px] uppercase hover:bg-slate-900/10" onClick={() => setLeaveOpen(true)}>
                Guide
              </Button>
              <a href={leaveFormUrl} target="_blank" rel="noreferrer" className="flex-[2]">
                <Button size="sm" className="w-full rounded-xl bg-rose-500 text-white shadow-lg shadow-rose-500/20 font-black text-[10px] uppercase tracking-widest">
                  <Download className="h-3.5 w-3.5 mr-1" /> Get Form
                </Button>
              </a>
            </div>
          </div>
        )}

      </CardContent>
    </Card>

    {/* GLASS DIALOGS */}

    {/* Biometrics Guide Dialog */}
    <Dialog open={bioGuideOpen} onOpenChange={setBioGuideOpen}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg bg-white/80 backdrop-blur-2xl border-white/40 rounded-[2.5rem] shadow-2xl p-6">
        <DialogHeader>
          <DialogTitle className="font-black uppercase tracking-tight text-slate-800">Biometrics Folder Guide</DialogTitle>
          <DialogDescription className="text-xs font-medium text-slate-500">
            Use this chart to match your BIO Group, Office, and Index Code.
          </DialogDescription>
        </DialogHeader>

        <div className="relative w-full overflow-hidden rounded-2xl border border-white/40 bg-slate-100 mt-2">
          <img src="/biometrics/biometrics-guide.png" alt="Guide" className="block w-full h-auto" />
          <img src="/logo.png" alt="" className="pointer-events-none absolute inset-0 m-auto h-40 opacity-10 select-none" />
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <a href="/biometrics/biometrics-guide.png" target="_blank" rel="noreferrer">
            <Button variant="ghost" size="sm" className="rounded-xl font-bold text-[10px] uppercase">New Tab</Button>
          </a>
          <Button size="sm" className="rounded-xl bg-slate-900 text-white px-6 font-black text-[10px] uppercase tracking-widest" onClick={() => setBioGuideOpen(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* COE/SR Status Dialog */}
    <Dialog open={docOpen} onOpenChange={setDocOpen}>
      <DialogContent className="bg-white/80 backdrop-blur-2xl border-white/40 rounded-[2.5rem]">
        <DialogHeader>
          <DialogTitle className="font-black uppercase tracking-tight">{primary.title}</DialogTitle>
          <DialogDescription className="text-sm font-medium">
            {primary.key === "sr"
              ? "Please coordinate with HRMO for manual Service Record issuance."
              : "Please coordinate with HRMO for manual COE issuance."}
          </DialogDescription>
        </DialogHeader>
        <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
            <p className="text-[11px] font-black uppercase tracking-widest text-indigo-600">
              Feature Roadmap: Online request + Email updates coming soon.
            </p>
        </div>
      </DialogContent>
    </Dialog>

    {/* Leave Instructions Dialog */}
    <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
      <DialogContent className="bg-white/80 backdrop-blur-2xl border-white/40 rounded-[2.5rem] p-8">
        <DialogHeader>
          <DialogTitle className="font-black uppercase tracking-tight">Leave Filing Process</DialogTitle>
          <DialogDescription className="font-medium text-rose-600 uppercase text-[10px] tracking-widest">
            Current Manual Workflow
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 my-2">
          {[
            "Download and print the official form.",
            "Complete all fields and sign.",
            "Attach required documents.",
            "Submit to your Office HR Focal."
          ].map((step, i) => (
            <div key={i} className="flex gap-3 items-center">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-bold">{i+1}</span>
              <span className="text-sm font-semibold text-slate-700">{step}</span>
            </div>
          ))}
        </div>
        <div className="pt-4 flex flex-col gap-3">
          <a href={leaveFormUrl} target="_blank" rel="noreferrer">
            <Button className="w-full rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-black text-[10px] uppercase tracking-widest">
              <Download className="h-4 w-4 mr-2" /> Download Official Form
            </Button>
          </a>
          <p className="text-[10px] text-center font-bold text-slate-400 uppercase tracking-tighter">
            Digital routing and approvals are currently in development.
          </p>
        </div>
      </DialogContent>
    </Dialog>

    {/* Training Placeholder Dialog */}
    <Dialog open={trainingOpen} onOpenChange={setTrainingOpen}>
      <DialogContent className="bg-white/80 backdrop-blur-2xl border-white/40 rounded-[2.5rem]">
        <DialogHeader>
          <DialogTitle className="font-black uppercase tracking-tight">Training Nomination</DialogTitle>
          <DialogDescription className="text-sm">
            Coordinate with HRMO Training Unit for nomination procedures.
          </DialogDescription>
        </DialogHeader>
        {trainingNominationFormUrl && (
          <a href={trainingNominationFormUrl} target="_blank" rel="noreferrer" className="mt-2">
            <Button size="sm" className="w-full rounded-xl bg-amber-500 text-white font-black text-[10px] uppercase tracking-widest">
              <Download className="h-4 w-4 mr-2" /> Download Nomination Form
            </Button>
          </a>
        )}
        
      </DialogContent>
    </Dialog>
<FloatingShortcuts />
  </TooltipProvider>
</section>
      <section id="hotlines">

        <HotlineDirectory items={LINGAYEN_HOTLINES} className="pt-6" />
      </section>

           {/* Floating shortcuts integrated inside the glass bounds */}
      
    </div>


  );
}
