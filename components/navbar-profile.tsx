"use client";

import { ChevronDown } from "lucide-react";
import { useClerk } from "@clerk/nextjs";

import { cn } from "@/lib/utils";

type NavbarProfileProps = {
  username: string;
  role: string;
  initials: string;
  imageUrl?: string | null;
  compact?: boolean;
};

export function NavbarProfile({
  username,
  role,
  initials,
  imageUrl,
  compact = false,
}: NavbarProfileProps) {
  const { openUserProfile } = useClerk();

  return (
    <button
      type="button"
      onClick={() => openUserProfile()}
      aria-label="Open Clerk profile settings"
      className={cn(
        "items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
        compact
          ? "inline-flex h-9 min-w-9 justify-center px-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 lg:hidden"
          : "hidden min-w-0 gap-2.5 border border-slate-200 bg-white px-2 py-1.5 hover:border-emerald-200 hover:bg-emerald-50 lg:flex"
      )}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className={cn("shrink-0 rounded-full object-cover", compact ? "h-7 w-7" : "h-8 w-8")}
        />
      ) : (
        <span
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-700",
            compact ? "h-8 w-8 bg-slate-100 text-xs text-slate-700" : "h-8 w-8 text-sm"
          )}
        >
          {initials || "U"}
        </span>
      )}

      {!compact ? (
        <>
          <span className="min-w-0 text-left leading-tight">
            <span className="block truncate text-sm font-semibold text-slate-900">{username}</span>
            <span className="block truncate text-xs text-slate-500">{role}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
        </>
      ) : null}
    </button>
  );
}
