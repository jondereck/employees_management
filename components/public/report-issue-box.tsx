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
    <section className={`mt-6 rounded-lg border bg-slate-50 p-3 sm:p-4 ${className}`}>
      <p className="text-sm text-slate-700">
        May napansing mali, kulang o katanungan ? Ipaalam sa HRMO para ma-update namin ang public record na ito.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {/* Email button */}
        <a
          href={mailto}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-slate-100"
        >
          {/* mail icon (inline svg) */}
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden className="opacity-80">
            <path d="M4 6h16a2 2 0 0 1 2 2v.217l-10 6.25-10-6.25V8a2 2 0 0 1 2-2Zm16 12H4a2 2 0 0 1-2-2V9.61l9.4 5.875a2 2 0 0 0 2.2 0L22 9.61V16a2 2 0 0 1-2 2Z" fill="currentColor"/>
          </svg>
          Notify HRMO via Email
        </a>

        {/* Messenger button (only if provided) */}
        {messengerIdOrUsername && (
          <a
            href={messengerHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-slate-100"
            aria-label="Chat with HRMO via Messenger"
          >
            {/* Messenger icon (inline svg) */}
            <svg width="16" height="16" viewBox="0 0 36 36" aria-hidden className="opacity-80">
              <path fill="#0099FF" d="M18 3C9.716 3 3 9.21 3 17.3c0 4.293 1.932 8.153 5.03 10.72.262.212.419.526.426.86l.086 3.04a1 1 0 0 0 1.43.87l3.398-1.687a1.6 1.6 0 0 1 1.03-.11c1.011.28 2.082.43 3.2.43 8.284 0 15-6.21 15-14.3S26.284 3 18 3Z"/>
              <path fill="#fff" d="m28.5 14.832-5.94 3.86a1.2 1.2 0 0 1-1.5-.12l-2.43-2.262a1.2 1.2 0 0 0-1.62-.04l-5.37 4.39c-.79.65-1.88-.38-1.23-1.19l5.94-7.28a1.2 1.2 0 0 1 1.71-.18l2.67 2.16a1.2 1.2 0 0 0 1.46.07l5.94-3.86c.83-.54 1.72.57 1.04 1.39Z"/>
            </svg>
            Chat via Messenger
          </a>
        )}
      </div>

      <p className="mt-2 text-[11px] text-slate-500">
        Huwag maglalagay ng personal/sensitive info (e.g., address, ID numbers).
      </p>
    </section>
  );
}
