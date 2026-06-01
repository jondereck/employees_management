"use client";

import { useEffect, useState } from "react";
import { GenioChat } from "./genio-chat";
import { GenioFloatingButton } from "./genio-floating-button";

type AnchorSide = "left" | "right";
const GENIO_ANCHOR_SIDE_KEY = "genio.anchorSide";

export const AskGenio = ({
  departmentId,
}: {
  departmentId: string;
}) => {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [prefill, setPrefill] = useState<string | null>(null);
  const [anchorSide, setAnchorSide] = useState<AnchorSide>("right");

  const showFloatingButton = !open || minimized;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(GENIO_ANCHOR_SIDE_KEY);
    if (raw === "left" || raw === "right") {
      setAnchorSide(raw);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(GENIO_ANCHOR_SIDE_KEY, anchorSide);
  }, [anchorSide]);

  return (
    <>
      {/* Floating Button + Thinking Bubbles */}
      {showFloatingButton && (
        <GenioFloatingButton
          anchorSide={anchorSide}
          isThinking={!open || minimized}
          onAnchorSideChange={setAnchorSide}
          onClick={() => {
            setOpen(true);
            setMinimized(false);
          }}
          onSelectThought={(template) => {
            setPrefill(template);
            setOpen(true);
            setMinimized(false);
          }}
        />
      )}

      {/* Chat Panel */}
      <div
        className={
          anchorSide === "left"
            ? "fixed bottom-3 left-3 z-50 sm:bottom-6 sm:left-6"
            : "fixed bottom-3 right-3 z-50 sm:bottom-6 sm:right-6"
        }
      >
        <GenioChat
          departmentId={departmentId}
          hidden={!open || minimized}
          onClose={() => setOpen(false)}
          prefill={prefill}
        />
      </div>
    </>
  );
};
