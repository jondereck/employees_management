"use client";

import { useState } from "react";
import { Bot, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GenioChat } from "./genio-chat";


export const AskGenio = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating Button */}
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg"
      >
        <Bot className="h-6 w-6" />
      </Button>

      {/* Chat Drawer */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[360px] rounded-xl border bg-background shadow-xl">
          <div className="flex items-center justify-between border-b p-3">
            <span className="font-semibold">Ask Genio</span>
            <Button size="icon" variant="ghost" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <GenioChat />
        </div>
      )}
    </>
  );
};
