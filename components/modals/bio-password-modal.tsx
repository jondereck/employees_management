"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogPortal,
} from "@/components/ui/dialog";

interface BioPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  departmentId: string;
}

export const BioPasswordModal = ({
  isOpen,
  onClose,
  onSuccess,
  departmentId,
}: BioPasswordModalProps) => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleClose = () => {
    setPassword("");
    setError("");
    onClose();
  };

  const handleSubmit = async () => {
    if (!password) {
      setError("Please enter the password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/${departmentId}/employees/verify-bio-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        }
      );

      if (res.ok) {
        setPassword("");
        onSuccess();
        onClose();
      } else {
        const data = await res.json();
        setError(data.error ?? "Incorrect password.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogPortal>
        <DialogContent className="fixed z-[9999] w-full max-w-sm p-6">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <DialogTitle>Unlock Bio Number</DialogTitle>
            </div>
            <DialogDescription>
              Enter the admin password to edit this employee&apos;s bio/ID number.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-2">
            <Input
              type="password"
              placeholder="Admin password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleSubmit()}
              disabled={loading}
              autoFocus
            />
            {error && (
              <p className="text-[12px] text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!password || loading}>
              {loading ? "Verifying..." : "Unlock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
};
