"use client";

import { useMemo } from "react";

type Props = {
  contactEmail: string;               // e.g. "hrmo@lingayen.gov.ph"
  employeeName: string;               // e.g. "JUDY D. VARGAS-QUIOCHO"
  employeeNo?: string | null;
  messengerIdOrUsername?: string;     // e.g. "LGULingayenOfficial" or "1234567890"
  className?: string;
};

export default function ReportIssueBox({
  contactEmail,
  employeeName,
  employeeNo,
  messengerIdOrUsername,
  className = "",
}: Props) {
  const pageUrl =
    typeof window !== "undefined" ? window.location.href : "";

  // mailto link with prefilled subject/body
  const mailto = useMemo(() => {
    const subject = `Public profile update request: ${employeeName}${employeeNo ? ` (${employeeNo})` : ""}`;
    const bodyLines = [
      `Hello HRMO,`,
      ``,
      `I noticed some information that might need updating on the public profile below:`,
      `Employee: ${employeeName}`,
      employeeNo ? `Employee No.: ${employeeNo}` : "",
      `Page: ${pageUrl}`,
      ``,
      `Suggested correction / details:`,
      `- `,
      ``,
      `Thank you.`,
    ].filter(Boolean);
    return `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join("\n"))}`;
  }, [contactEmail, employeeName, employeeNo, pageUrl]);

  // Messenger deep link
  // Use m.me/<page> with a ref payload (so HR knows which profile/page)
  const messengerHref = useMemo(() => {
    if (!messengerIdOrUsername) return "";
    const refPayload = {
      source: "hrps_public_profile",
      employeeName,
      employeeNo: employeeNo ?? undefined,
      pageUrl,
    };
    const ref = encodeURIComponent(JSON.stringify(refPayload));
    return `https://m.me/${encodeURIComponent(messengerIdOrUsername)}?ref=${ref}`;
  }, [messengerIdOrUsername, employeeName, employeeNo, pageUrl]);

  return (
<section className={`mt-10 rounded-[2rem] border border-white/40 bg-white/20 backdrop-blur-md p-5 sm:p-6 shadow-xl ${className}`}>
  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div className="space-y-1">
      <h4 className="text-sm font-black uppercase tracking-widest text-slate-800">
        Public Record Verification
      </h4>
      <p className="text-sm font-medium text-slate-600 leading-relaxed max-w-xl">
        May napansing mali, kulang o katanungan? Ipaalam sa HRMO para ma-update namin ang public record na ito.
      </p>
    </div>

    <div className="flex flex-wrap gap-3">
      {/* Email button: Soft Indigo Glow */}
      <a
        href={mailto}
        className="inline-flex items-center gap-2 rounded-xl border border-white/60 bg-white/50 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-indigo-700 shadow-sm transition-all hover:bg-white/80 hover:shadow-indigo-500/10 active:scale-95"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
        </svg>
        Notify via Email
      </a>

      {/* Messenger button: Soft Sky Glow */}
      {messengerIdOrUsername && (
        <a
          href={messengerHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-white/60 bg-white/50 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-sky-700 shadow-sm transition-all hover:bg-white/80 hover:shadow-sky-500/10 active:scale-95"
          aria-label="Chat with HRMO via Messenger"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m7.9 20 2.8-2.8c.7.2 1.5.3 2.3.3 4.4 0 8-3.1 8-7s-3.6-7-8-7-8 3.1-8 7c0 1.7.7 3.3 2 4.6l-2.1 4.9Z"/>
          </svg>
          Messenger Chat
        </a>
      )}
    </div>
  </div>

  <div className="mt-4 flex items-center gap-2 border-t border-white/20 pt-4">
    <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
    <p className="text-[10px] font-bold uppercase tracking-tighter text-slate-500">
      Security Reminder: Huwag maglalagay ng personal/sensitive info (e.g., address, ID numbers).
    </p>
  </div>
</section>
  );
}
