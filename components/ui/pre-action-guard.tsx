"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

type PreActionGuardProps = {
  /** Unique key; combined with policyId for the localStorage entry */
  storageKey: string;
  /** Change this to invalidate old agreements and show dialog again */
  policyId?: string;

  /** If provided, opens this URL on proceed (ignored when onProceed exists) */
  href?: string;
  /** Open href in new tab (default true) */
  newTab?: boolean;

  /** Custom action to run on proceed (takes precedence over href) */
  onProceed?: () => void | Promise<void>;

  /** Dialog content */
  title?: React.ReactNode;
  subtitle?: React.ReactNode; // NEW
  description?: React.ReactNode;
  bullets?: React.ReactNode[];

  /** Default trigger (shown if renderTrigger not provided) */
  buttonText?: React.ReactNode;
  buttonIconLeft?: React.ReactNode;
  buttonProps?: Omit<ButtonProps, "onClick" | "children">;

  /** Custom trigger renderer (gets open() helper) */
  renderTrigger?: (open: () => void) => React.ReactNode;

  /** Start open (rare) */
  defaultOpen?: boolean;
  /** Optional callback when open state changes */
  onOpenChange?: (open: boolean) => void;
};

export function PreActionGuard({
  storageKey,
  policyId = "v1",
  href,
  newTab = true,
  onProceed,
  title = "Before you continue",
  subtitle, // NEW
  description = "Please review these reminders:",
  bullets = [],
  buttonText = "Continue",
  buttonIconLeft,
  buttonProps,
  renderTrigger,
  defaultOpen = false,
  onOpenChange,
}: PreActionGuardProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [agree, setAgree] = React.useState(false);
  const [dontShow, setDontShow] = React.useState(false);

  const LS_KEY = `${storageKey}:${policyId}`;

  const changeOpen = (v: boolean) => {
    setOpen(v);
    onOpenChange?.(v);
  };

  const shouldSkip = React.useCallback(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(LS_KEY) === "1";
    } catch {
      return false;
    }
  }, [LS_KEY]);

  const doProceed = React.useCallback(() => {
    if (dontShow) {
      try {
        localStorage.setItem(LS_KEY, "1");
      } catch {}
    }
    changeOpen(false);

    if (onProceed) {
      void onProceed();
    } else if (href) {
      if (newTab) {
        window.open(href, "_blank", "noopener,noreferrer");
      } else {
        window.location.href = href;
      }
    }
  }, [dontShow, LS_KEY, href, newTab, onProceed]);

  const triggerClick = React.useCallback(() => {
    if (shouldSkip()) {
      // Immediately proceed without showing dialog
      if (onProceed) void onProceed();
      else if (href) newTab ? window.open(href, "_blank", "noopener,noreferrer") : (window.location.href = href);
      return;
    }
    setAgree(false);
    setDontShow(false);
    changeOpen(true);
  }, [shouldSkip, href, newTab, onProceed]);

  const Trigger =
    renderTrigger ??
    ((openFn: () => void) => (
      <Button {...buttonProps} onClick={openFn}>
        {buttonIconLeft ? <span className="mr-1 inline-flex">{buttonIconLeft}</span> : null}
        {buttonText}
      </Button>
    ));

  return (
    <>
      {Trigger(triggerClick)}

      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {subtitle ? <div className="text-sm text-muted-foreground">{subtitle}</div> : null}
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          {bullets.length > 0 && (
            <ul className="list-disc pl-5 text-sm space-y-1">
              {bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}

          <div className="mt-3 space-y-3">
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={agree} onCheckedChange={(v) => setAgree(Boolean(v))} />
              <span>I have read and understood the notice, and I agree to proceed.</span>
            </label>

            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <Checkbox checked={dontShow} onCheckedChange={(v) => setDontShow(Boolean(v))} />
              <span>Don’t show this again for this action</span>
            </label>
          </div>

          <div className="mt-4 flex gap-2 justify-end">
            <Button variant="outline" onClick={() => changeOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!agree} onClick={doProceed}>
              I understand — continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
