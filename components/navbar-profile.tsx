"use client";

import { UserButton } from "@clerk/nextjs";

import { cn } from "@/lib/utils";

type NavbarProfileProps = {
  username: string;
  role: string;
  compact?: boolean;
};

export function NavbarProfile({ username, role, compact = false }: NavbarProfileProps) {
  return (
    <div
      className={cn(
        "items-center",
        compact
          ? "inline-flex h-9 min-w-9 justify-center lg:hidden"
          : "hidden min-w-0 gap-2.5 rounded-full border border-slate-200 bg-white px-2 py-1.5 lg:flex"
      )}
    >
      {!compact ? (
        <span className="min-w-0 text-left leading-tight">
          <span className="block truncate text-sm font-semibold text-slate-900">{username}</span>
          <span className="block truncate text-xs text-slate-500">{role}</span>
        </span>
      ) : null}
      <UserButton
        afterSignOutUrl="/sign-in"
        appearance={{
          elements: {
            avatarBox: compact ? "h-7 w-7" : "h-8 w-8",
            userButtonPopoverCard: "z-[250]",
          },
        }}
      />
    </div>
  );
}
