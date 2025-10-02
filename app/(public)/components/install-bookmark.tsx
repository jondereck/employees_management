"use client";

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { BookmarkPlus, Smartphone } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function InstallOrBookmarkFAB({
  bottomOffsetRem = 8, // keep this above your existing FAB (which is at ~5rem)
  className,
}: {
  /** Space from bottom in rem (will combine with safe-area inset) */
  bottomOffsetRem?: number;
  className?: string;
}) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [installable, setInstallable] = useState(false);

  // Detect if running as an installed app already (standalone)
  const isStandalone = useMemo(() => {
    if (typeof window === "undefined") return false;
    // iOS Safari
    if ((window.navigator as any).standalone) return true;
    // Others
    return window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
  }, []);

  // Basic platform detection -> only for instruction text
  const platform: "ios" | "android" | "desktop" = useMemo(() => {
    if (typeof navigator === "undefined") return "desktop";
    const ua = navigator.userAgent || "";
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform ?? "").includes("Mac") && "ontouchend" in window;
    const isAndroid = /Android/.test(ua);
    if (isIOS) return "ios";
    if (isAndroid) return "android";
    return "desktop";
  }, []);

  useEffect(() => {
    // Catch the PWA install prompt when it becomes available
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault(); // prevent the mini-infobar
      const evt = e as BeforeInstallPromptEvent;
      setDeferredPrompt(evt);
      setInstallable(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt as any);

    // Also try to infer installability (not perfect but helps pre-render)
    if (window.matchMedia?.("(display-mode: browser)").matches) {
      // only when in browser context we consider showing
      setInstallable(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt as any);
  }, []);

  // Don’t show if already installed
  if (isStandalone) return null;

  const handleClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        await deferredPrompt.userChoice; // optional await result
        setDeferredPrompt(null);
      } catch {
        // If user dismisses or prompt fails, fall back to instructions
        setOpen(true);
      }
    } else {
      // No prompt available — show instructions
      setOpen(true);
    }
  };

  return (
    <>
      <Button
        size="icon"
        className={cn(
          "fixed right-[calc(1rem+env(safe-area-inset-right))] z-50 h-12 w-12 rounded-full shadow-lg print:hidden",
          "bg-indigo-600 hover:bg-indigo-700 text-white",
          className
        )}
        style={{ bottom: `calc(${bottomOffsetRem}rem + env(safe-area-inset-bottom))` }}
        onClick={handleClick}
        aria-label={installable ? "Install app or bookmark" : "Bookmark or add to Home Screen"}
        title={installable ? "Install App" : "Save / Add to Home Screen"}
      >
        {/* Use a combined icon to imply install/bookmark */}
        <Smartphone className="h-5 w-5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save this app</DialogTitle>
            <DialogDescription>
              Make it easy to open next time by installing or bookmarking it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {platform === "android" && (
              <div className="rounded-lg border p-3">
                <p className="font-medium mb-1">Android (Chrome)</p>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Tap the <span className="font-semibold">⋮</span> (menu) in the top-right.</li>
                  <li>Choose <span className="font-semibold">Install app</span> or <span className="font-semibold">Add to Home screen</span>.</li>
                </ol>
              </div>
            )}

            {platform === "ios" && (
              <div className="rounded-lg border p-3">
                <p className="font-medium mb-1">iPhone / iPad (Safari)</p>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Tap the <span className="font-semibold">Share</span> button.</li>
                  <li>Choose <span className="font-semibold">Add to Home Screen</span>.</li>
                </ol>
              </div>
            )}

            {platform === "desktop" && (
              <div className="rounded-lg border p-3">
                <p className="font-medium mb-1">Desktop</p>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>
                    <span className="font-semibold">Install</span> (if available): look for the install icon in the address bar.
                  </li>
                  <li>
                    <span className="font-semibold">Bookmark:</span>{" "}
                    <kbd className="px-1 py-0.5 rounded border">Ctrl</kbd>+<kbd className="px-1 py-0.5 rounded border">D</kbd> (Windows)
                    or <kbd className="px-1 py-0.5 rounded border">⌘</kbd>+<kbd className="px-1 py-0.5 rounded border">D</kbd> (Mac).
                  </li>
                </ol>
              </div>
            )}

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BookmarkPlus className="h-4 w-4" />
              <span>You can always use this button again if you need help.</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
