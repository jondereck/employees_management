"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Globe, Globe2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  employeeId: string;
  initialEnabled: boolean;
};

export default function TogglePublicBadge({
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
        
        const nextValue = Boolean(json?.publicEnabled);
        setEnabled(nextValue);
        
        toast.success(nextValue ? "Profile is now Public" : "Profile is now Private");
        router.refresh();
      } catch (error) {
        toast.error("Failed to update visibility");
      }
    });
  };

  return (
    <button
      onClick={onToggle}
      disabled={pending}
      className={cn(
        // Base badge styles matching your screenshot
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed",
        // Conditional styles based on enabled status
        enabled 
          ? "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100" 
          : "bg-red-500 text-white border-red-600 hover:bg-red-600 shadow-sm"
      )}
    >
      {pending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : enabled ? (
        <Globe2 className="h-3 w-3" />
      ) : (
        <Globe className="h-3 w-3" />
      )}
      
      {pending ? "Updating..." : enabled ? "Public Enabled" : "Disable / Private"}
    </button>
  );
}