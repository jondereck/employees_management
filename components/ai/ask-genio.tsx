"use client";

import { useState } from "react";
import { GenioChat } from "./genio-chat";
import { GenioFloatingButton } from "./genio-floating-button";

export const AskGenio = ({
  departmentId,
}: {
  departmentId: string;
}) => {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [prefill, setPrefill] = useState<string | null>(null);

  const showFloatingButton = !open || minimized;

  

  return (
    <>
      {/* Floating Button + Thinking Bubbles */}
      {showFloatingButton && (
        <GenioFloatingButton
          isThinking={!open || minimized}
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
      <div className="fixed bottom-6 right-6 z-50">
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
