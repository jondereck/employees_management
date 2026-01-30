"use client";

import { useState } from "react";
import { Bot, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GenioChat } from "./genio-chat";
import PreviewModal from "@/app/(dashboard)/[departmentId]/(routes)/(frontend)/view/components/preview";
import Image from "next/image";
import { GenioFloatingButton } from "./genio-floating-button";
export const AskGenio = ({
  departmentId,
}: {
  departmentId: string;
}) => {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const showFloatingButton = !open || minimized;

  return (
    <>
      {/* Floating Button */}


      {showFloatingButton && (
        <GenioFloatingButton
          isThinking={!open || minimized}
          onClick={() => {
            setOpen(true);
            setMinimized(false);
          }}
        />
      )}


      {/* Chat Panel */}
      <div className="fixed bottom-6 right-6 z-50">
        <GenioChat
          departmentId={departmentId}
          onClose={() => setOpen(false)}
          hidden={!open || minimized}
        />
      </div>

    </>
  );
};
