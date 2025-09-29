"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type PreSubmitAgreementProps = {
  /** Stable id for this action; used for "Don't show again" localStorage key */
  actionId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Called only after user confirms */
  onConfirm: () => void;
  /** Optional: if true and user has "skip" saved, we auto-confirm silently on mount */
  autoConfirmIfPreviouslyAgreed?: boolean;

  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** You can pass jsx to render your copy/policy */
  children?: React.ReactNode;
  /** Extra: disable while parent is submitting */
  disabled?: boolean;
};

const STORAGE_PREFIX = "hrps.agreeGate.skip.";

export function hasAgreementSkip(actionId: string) {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_PREFIX + actionId) === "1";
}

export default function PreSubmitAgreement({
  actionId,
  open,
  onOpenChange,
  onConfirm,
  autoConfirmIfPreviouslyAgreed = true,
  title = "Before you continue",
  confirmLabel = "I understand — continue",
  cancelLabel = "Cancel",
  children,
  disabled,
}: PreSubmitAgreementProps) {
  const [checked, setChecked] = React.useState(false);
  const [dontShow, setDontShow] = React.useState(false);

  // If user previously chose "Don't show again", auto-confirm
  React.useEffect(() => {
    if (!open) return;
    if (!autoConfirmIfPreviouslyAgreed) return;
    if (hasAgreementSkip(actionId)) {
      // small delay so parent state is ready
      setTimeout(() => {
        onOpenChange(false);
        onConfirm();
      }, 10);
    }
  }, [open, autoConfirmIfPreviouslyAgreed, actionId, onConfirm, onOpenChange]);

  function handleConfirm() {
    if (!checked) return;
    if (dontShow) {
      try {
        window.localStorage.setItem(STORAGE_PREFIX + actionId, "1");
      } catch { /* ignore */ }
    }
    onOpenChange(false);
    onConfirm();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !disabled && onOpenChange(v)}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {/* Your policy / agreement copy */}
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {children ?? (
              <>
                <p>
                  By proceeding, you acknowledge that HRMO may request supporting documents to verify the authenticity of
                  your submitted details (e.g., certificates, trainings, memos). Submissions found to be inaccurate may be
                  rejected or reverted.
                </p>
                <ul>
                  <li>Provide clear and legible copies of certificates when asked</li>
                  <li>Ensure dates and titles match the official records</li>
                  <li>Misrepresentation may lead to administrative actions</li>
                </ul>
              </>
            )}
          </div>

          <div className="flex items-start gap-3 pt-1">
            <Checkbox id="agree" checked={checked} onCheckedChange={(v) => setChecked(Boolean(v))} />
            <Label htmlFor="agree" className="text-sm leading-tight cursor-pointer select-none">
              I have read and understood the notice, and I agree to proceed.
            </Label>

            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="ml-auto" type="button" tabIndex={0} aria-label="Policy help">
                    ?
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs">
                  This is a quick acknowledgment. HRMO may follow up for files (images/PDF) to verify your request.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="flex items-center gap-3">
            <Checkbox
              id="dontshow"
              checked={dontShow}
              onCheckedChange={(v) => setDontShow(Boolean(v))}
              disabled={!checked}
            />
            <Label
              htmlFor="dontshow"
              className={`text-xs cursor-pointer select-none ${!checked ? "text-muted-foreground" : ""}`}
              title={!checked ? "Confirm agreement first" : ""}
            >
              Don’t show this again for this action
            </Label>
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={disabled}>
            {cancelLabel}
          </Button>
          <Button onClick={handleConfirm} disabled={!checked || disabled}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
