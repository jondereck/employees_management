"use client";

import { useState } from "react";
import { Bot, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GenioChat } from "./genio-chat";
import PreviewModal from "@/app/(dashboard)/[departmentId]/(routes)/(frontend)/view/components/preview";
import Image from "next/image";
export const AskGenio = ({
  departmentId,
  onOpenChange,
}: {
  departmentId: string;
  onOpenChange?: (open: boolean) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const showFloatingButton = !open || minimized;

  return (
    <>
      {/* Floating Button */}
      {showFloatingButton && (
        <Button
          variant="outline"
          onClick={() => {
            setOpen(true);
            setMinimized(false);
            onOpenChange?.(true);
          }}
          className="fixed bottom-6 right-6 z-40 h-16 w-16 rounded-full p-0 overflow-hidden shadow-lg"
        >
          <Image
            src="/genio/genio-avatar.png"
            alt="Genio AI"
            fill
            className="object-cover"
            priority
          />
        </Button>
      )}

      {/* Chat Panel */}
      <div className="fixed bottom-6 right-6 z-50">
        <GenioChat
          departmentId={departmentId}
          onClose={() => {
            setOpen(false);
            onOpenChange?.(false); // 👈 notify parent
          }}
          hidden={!open || minimized}
        />
      </div>

    </>
  );
};
