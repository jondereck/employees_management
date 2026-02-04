"use client";

import axios from "axios";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RefreshCcw } from "lucide-react";

type Props = {
  departmentId: string;
  employeesId: string;
};

export default function RegenerateQrButton({
  departmentId,
  employeesId,
}: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    const confirmed = window.confirm(
      "This will invalidate ALL previously issued QR codes for this employee.\n\nContinue?"
    );
    if (!confirmed) return;

    try {
      setLoading(true);
      await axios.post(
        `/api/${departmentId}/employees/${employeesId}/regenerate-qr`
      );

      toast.success("QR regenerated. Old IDs are now invalid.");

      // refresh to update QR + version
      window.location.reload();
    } catch (err) {
      toast.error("Failed to regenerate QR.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-2"
    >
      <RefreshCcw className="h-4 w-4" />
      Regenerate QR
    </Button>
  );
}
