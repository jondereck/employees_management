"use client";

import { useState } from "react";

export default function ActionBar({
  departmentId,
  employeeId,
  isArchived,
  onEdit,
  onArchiveToggle,
}: {
  departmentId: string;
  employeeId: string;
  isArchived: boolean;
  onEdit?: () => void;
  onArchiveToggle?: () => Promise<void> | void; // call your API/modal
}) {
  const [copying, setCopying] = useState(false);

  const vcardHref = `/api/public/vcard?departmentId=${departmentId}&employeeId=${employeeId}`;

  async function handleCopyLink() {
    try {
      setCopying(true);
      const url = window.location.origin + `/${departmentId}/(routes)/(frontend)/view/employee/${employeeId}`;
      await navigator.clipboard.writeText(url);
      // you can replace with sonner toast if you like
      alert("Public link copied!");
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {/* Edit */}
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
      >
        ✏️ Edit Employee
      </button>

      {/* vCard */}
      <a
        href={vcardHref}
        className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
      >
        📇 Download vCard
      </a>

      {/* Archive / Unarchive */}
      <button
        type="button"
        onClick={onArchiveToggle}
        className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
      >
        {isArchived ? "♻️ Unarchive" : "🗄️ Archive"}
      </button>

      {/* Copy public link */}
      <button
        type="button"
        onClick={handleCopyLink}
        className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
        disabled={copying}
      >
        🔗 {copying ? "Copying…" : "Copy public link"}
      </button>
    </div>
  );
}
