"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
      const res = await fetch(
        `/api/employee/${employeeId}/toggle-public`,
        { method: "POST" }
      );
      if (!res.ok) {
        toast.error("Failed to toggle public profile");
        return;
      }
      const json = await res.json();
      setEnabled(Boolean(json?.publicEnabled));
      toast.success(json?.publicEnabled ? "Public profile enabled" : "Public profile disabled");
      router.refresh();
    });
  };

  return (
    <Button onClick={onToggle} disabled={pending} variant={enabled ? "destructive" : "default"}>
      {enabled ? "Disable Public Profile" : "Enable Public Profile"}
    </Button>
  );
}
