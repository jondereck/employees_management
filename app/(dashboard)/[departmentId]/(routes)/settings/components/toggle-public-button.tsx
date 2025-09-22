"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Globe, Globe2Icon,  } from "lucide-react";

type Props = {
  departmentId: string;
  employeeId: string;
  initialEnabled: boolean;
};

export default function TogglePublicButton({
  departmentId,
  employeeId,
  initialEnabled,
}: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  const onToggle = () => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/employee/${employeeId}/toggle-public`, { method: "POST" });
        if (!res.ok) throw new Error();
        const json = await res.json();
        const next = Boolean(json?.publicEnabled);
        setEnabled(next);
        toast.success(next ? "Public profile enabled" : "Public profile disabled");
        router.refresh();
      } catch {
        toast.error("Failed to toggle public profile");
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      {/* SMALLER button */}
      <Button
        onClick={onToggle}
        disabled={pending}
        size="sm"                                     // ← makes it smaller
        variant={enabled ? "destructive" : "default"}
        className="h-8 px-3 text-xs"                 // ← extra compact
        aria-pressed={enabled}
      >
        {pending ? (
          <>
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            Saving…
          </>
        ) : enabled ? (
          <>
            <Globe2Icon className="mr-2 h-3.5 w-3.5" />
            Disable
          </>
        ) : (
          <>
            <Globe className="mr-2 h-3.5 w-3.5" />
            Enable Public
          </>
        )}
      </Button>

      {/* tiny status chip */}
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] leading-none ${
          enabled
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-zinc-200 bg-zinc-50 text-zinc-600"
        }`}
      >
        {enabled ? "Public enabled" : "Public disabled"}
      </span>
    </div>
  );
}
