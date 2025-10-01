"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Landmark, Calendar, Download, FileText, Wrench, GraduationCap, HeartHandshake, Fingerprint, RotateCcw } from "lucide-react";
import { IdCardIcon } from "@radix-ui/react-icons";
import { PreActionGuard } from "@/components/ui/pre-action-guard";
import PdfViewerTile from "./pdf-viewer-tile";


type Props = {
  employeeId: string;
  employeeType?: string | null;          // "Permanent" | "Casual" | "Co-terminous" | "Job Order" | etc.
  leaveFormUrl?: string;
  forms?: Array<{ label: string; href: string }>;
  trainingCalendarUrl?: string;          // e.g. "/files/TrainingCalendar.pdf" or external link
  trainingNominationFormUrl?: string; biometricsFolderUrl?: string;
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
      <section>
        <TooltipProvider delayDuration={200}>
          <Card className="rounded-lg border">
            <CardHeader className="flex items-center justify-between space-y-0">
              <CardTitle className="text-base font-semibold">Self-Service</CardTitle>
              <Badge variant="secondary" className="gap-1">
                <Wrench className="h-3.5 w-3.5" />
                Ongoing
              </Badge>
            </CardHeader>

            <Button
              size="icon"
              className="fixed right-[calc(1rem+env(safe-area-inset-right))] z-50 h-12 w-12 rounded-full shadow-lg print:hidden
             bg-pink-600 hover:bg-pink-700 text-white"
              style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }} // ↑ adjust 5rem to match footer height
              onClick={() =>
                document.getElementById("self-service")?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              aria-label="Open Self-Service"
            >
              <HeartHandshake className="h-5 w-5" />
            </Button>

            {/* Responsive grid: 1 / 2 / 3 cols */}
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Primary: COE/SR (single action that adapts) */}
              {biometricsFolderUrl && (
                <div className="rounded-md border p-3 flex flex-col">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Fingerprint className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium text-sm sm:text-base">Biometrics Logs</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Badge variant="outline">Drive</Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        title="Refresh"
                        onClick={() => fetchBiometricsMeta(biometricsFolderUrl)}
                        disabled={bioLoading}
                      >
                        <RotateCcw className={`h-4 w-4 ${bioLoading ? "animate-spin" : ""}`} />
                      </Button>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-muted-foreground mb-3">
                    Download your monthly attendance files. This is the same data we email—scan the QR, open Self-Service, and get it anytime.
                  </p>

                  <div className="mt-auto flex flex-col sm:flex-row gap-2">

                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => setBioGuideOpen(true)}
                    >
                      Guide
                    </Button>
                    <PreActionGuard
                      storageKey="biometrics_warn"
                      policyId="2025-09"            // bump this when you change wording/policy to re-show dialog
                      href={biometricsFolderUrl}
                      newTab
                      title="Before you open the Biometrics folder"
                      subtitle="Google Drive → Biometrics"
                      description="To ensure proper use:"
                      bullets={[
                        <>Use only the files for your <strong>office/BIO group</strong>.</>,
                        <>Verify using your <strong>Employee No. / BIO number</strong> on your profile.</>,
                        <>Match your <strong>BIO Group, Office/Building</strong>, and <strong>Index Code</strong> from the <strong>guide</strong>.</>,
                        <>Misuse or misrepresentation may lead to rejection or administrative action.</>,
                      ]}
                      buttonText={<>Open Drive Folder</>}
                      buttonIconLeft={<Download className="h-4 w-4" />}
                      buttonProps={{ size: "sm", className: "w-full sm:w-auto" }}
                    />

                  </div>

                  {/* Status line */}
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    {bioLoading && <span>Checking last update…</span>}
                    {!bioLoading && bioError && <span className="text-red-600">Error: {bioError}</span>}
                    {!bioLoading && !bioError && lastUpdated && <span>Updated: {fmtPH(lastUpdated)}</span>}
                    {!bioLoading && !bioError && !lastUpdated && <span>No files detected yet.</span>}
                  </div>
                </div>
              )}


              {/* Downloadable Forms (single place) */}
              <div className="rounded-md border p-3 flex flex-col">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center justify-between gap-2">
                    {/* Left: icon + label */}
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium text-sm sm:text-base truncate">
                        Downloadable Forms
                      </span>
                    </div>

                    {/* Right: badge */}
                    <Badge variant="outline" className="whitespace-nowrap shrink-0">
                      Download
                    </Badge>
                  </div>

                </div>
                <ul className="text-sm space-y-2 mb-2">
                  {forms.map((f) => (
                    <li key={f.label} className="flex items-center justify-between gap-2">
                      <span className="text-xs sm:text-sm">{f.label}</span>
                      <a href={f.href} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="outline" className="h-7">
                          <Download className="h-3.5 w-3.5 mr-1" />
                          Get
                        </Button>
                      </a>
                    </li>
                  ))}
                </ul>

              </div>
              <div className="rounded-md border p-3 flex flex-col">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <PrimaryIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium text-sm sm:text-base">{primary.title}</span>
                  </div>
                  <Badge variant="secondary">Ongoing</Badge>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-3 flex-grow">
                  {primary.key === "sr"
                    ? "Available for Permanent, Co-terminous, and Casual employees."
                    : "Submit a COE request. Processing and release by HRMO."}
                </p>
                <Button size="sm" className="w-full sm:w-auto mt-auto" onClick={() => setDocOpen(true)}>
                  {primary.btn}
                </Button>
              </div>

              {/* File a Leave */}

              {canFileLeave && (
                <div className="rounded-md border p-3 flex flex-col">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium text-sm sm:text-base">File a Leave</span>
                    </div>
                    <Badge variant="outline">Download</Badge>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-3 flex-grow">
                    Download the leave form and submit to your Office HR Focal.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 mt-auto">
                    <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => setLeaveOpen(true)}>
                      Guide
                    </Button>
                    <a href={leaveFormUrl} target="_blank" rel="noreferrer" className="w-full sm:w-auto">
                      <Button size="sm" className="w-full sm:w-auto">
                        <Download className="h-4 w-4 mr-1" />
                        Download Leave Form
                      </Button>
                    </a>
                  </div>
                </div>
              )}




              {/* Training & Development */}
              <div className="rounded-md border p-3 flex flex-col">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium text-sm sm:text-base">Training &amp; Development</span>
                  </div>
                  <Badge variant="secondary">Ongoing</Badge>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-3 flex-grow">
                  View the training calendar or submit a nomination for upcoming programs.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 mt-auto">
                  <a href={trainingCalendarUrl} target="_blank" rel="noreferrer" className="w-full sm:w-auto">
                    <Button size="sm" variant="outline" className="w-full sm:w-auto">
                      <Calendar className="h-4 w-4 mr-1" />
                      View Calendar
                    </Button>
                  </a>

                  {trainingNominationFormUrl ? (
                    <a
                      href={trainingNominationFormUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full sm:w-auto"
                    >
                      <Button size="sm" className="w-full sm:w-auto">
                        <Download className="h-4 w-4 mr-1" />
                        Nomination Form
                      </Button>
                    </a>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => setTrainingOpen(true)}
                    >
                      Nominate
                    </Button>
                  )}
                </div>
              </div>

              {/* ID & Profile */}
              <div className="rounded-md border p-3 flex flex-col">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {/* lucide-react: UserRound or IdCard */}
                    <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" /><path d="M4 20a8 8 0 0 1 16 0" stroke="currentColor" /></svg>
                    <span className="font-medium text-sm sm:text-base">ID &amp; Profile</span>
                  </div>
                  <Badge variant="secondary">Ongoing</Badge>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-3">
                  Update profile photo or request ID reprint (lost/damaged).
                </p>
                <div className="flex flex-col sm:flex-row gap-2 mt-auto">
                  <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => setDocOpen(true)}>
                    Update Photo
                  </Button>
                  <Button size="sm" className="w-full sm:w-auto" onClick={() => setDocOpen(true)}>
                    ID Reprint
                  </Button>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* Biometrics: Guide image with watermark */}
          <Dialog open={bioGuideOpen} onOpenChange={setBioGuideOpen}>
            <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle>Biometrics Folder Guide</DialogTitle>
                <DialogDescription>
                  Use this chart to match your BIO Group, Office/Building, and Index Code, then open the correct folder.
                </DialogDescription>
              </DialogHeader>

              {/* Image container with watermark overlay */}
              <div className="relative w-full overflow-hidden rounded-md border">
                {/* Main guide image */}
                <img
                  src="/biometrics/biometrics-guide.png"
                  alt="BIO Location Guide"
                  className="block w-full h-auto"
                  loading="eager"
                />


                <img src="/logo.png" alt="" aria-hidden="true"
                  className="pointer-events-none select-none absolute inset-0 m-auto h-60 opacity-10" />

              </div>

              <div className="flex justify-end gap-2">
                <a href="/biometrics/biometrics-guide.png" target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm">Open image in new tab</Button>
                </a>
                <Button size="sm" onClick={() => setBioGuideOpen(false)}>Close</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Unified COE/SR dialog */}
          <Dialog open={docOpen} onOpenChange={setDocOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{primary.title}</DialogTitle>
                <DialogDescription>
                  {primary.key === "sr"
                    ? "This feature is under development. For now, coordinate with HRMO for your Service Record."
                    : "This feature is under development. For now, coordinate with HRMO for your COE."}
                </DialogDescription>
              </DialogHeader>
              <p className="text-[11px] text-muted-foreground">
                Coming soon: Online request with email updates and pickup schedule.
              </p>
            </DialogContent>
          </Dialog>

          {/* Leave guide dialog */}
          <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>File a Leave</DialogTitle>
                <DialogDescription>
                  Download, fill out, and submit the leave form to your Office HR Focal Person.
                </DialogDescription>
              </DialogHeader>
              <ol className="list-decimal ml-5 text-sm space-y-1">
                <li>Download the official leave form.</li>
                <li>Fill out all required fields and sign.</li>
                <li>Attach supporting documents (if any).</li>
                <li>Submit to your Office HR Focal for routing and approval.</li>
              </ol>
              <div className="pt-3">
                <a href={leaveFormUrl} target="_blank" rel="noreferrer">
                  <Button size="sm">
                    <Download className="h-4 w-4 mr-1" />
                    Download Leave Form
                  </Button>
                </a>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Coming soon: Online leave filing with routing & approvals.
              </p>
            </DialogContent>
          </Dialog>


          {/* Training dialog (if no nomination form yet) */}
          <Dialog open={trainingOpen} onOpenChange={setTrainingOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Training Nomination</DialogTitle>
                <DialogDescription>
                  This feature is under development. Coordinate with the HRMO Training Unit for nominations.
                </DialogDescription>
              </DialogHeader>
              {trainingNominationFormUrl ? (
                <a href={trainingNominationFormUrl} target="_blank" rel="noreferrer">
                  <Button size="sm">
                    <Download className="h-4 w-4 mr-1" />
                    Download Nomination Form
                  </Button>
                </a>
              ) : null}
              <p className="text-[11px] text-muted-foreground">
                Coming soon: Online nomination with supervisor approval workflow.
              </p>
            </DialogContent>
          </Dialog>

        </TooltipProvider>
      </section>

      {/* Resources */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Resources</h2>
          <span className="text-xs text-muted-foreground">Read & download</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <PdfViewerTile
            title="Handbook & Policies"
            description="Open and read without leaving the app"
            pdfUrl="/files/employee-handbook.pdf"
            watermarkImageUrl="/logo.png"     // from /public
            watermarkText="Municipality of Lingayen"
            autoThumbnail
            // usePdfJsViewer
            wmRotationDeg={0}           // ← straight, no tilt
            wmOpacity={0.15}
            wmSize={0.35}
            downloadFileName="Handbook-Lingayen.pdf"
          />

          {/* <PdfViewerTile
            title="ARTA"
            description="Open and read without leaving the app"
            pdfUrl="/files/employee-handbook.pdf"
            watermarkImageUrl="/logo.png"     // from /public
            watermarkText="Municipality of Lingayen"
            autoThumbnail
            wmRotationDeg={0}           // ← straight, no tilt
            wmOpacity={0.15}
            wmSize={0.35}
            downloadFileName="Handbook-Lingayen.pdf"
          /> */}
          {/* future: Policies, Code of Conduct, FAQ, etc. */}
        </div>
      </section>
    </div>


  );
}
