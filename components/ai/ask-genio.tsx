"use client";

import { useState } from "react";
import { Bot, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GenioChat } from "./genio-chat";
import PreviewModal from "@/app/(dashboard)/[departmentId]/(routes)/(frontend)/view/components/preview";
import Image from "next/image";

export const AskGenio = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating Button */}
      {!open && (
       <Button
       variant={"outline"}
  onClick={() => setOpen(true)}
  className="fixed bottom-6 right-6 z-40 h-16 w-16 rounded-full p-0 overflow-hidden shadow-lg items-center justify-center flex bg-purple-200 "
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
      {open && (
        <div className="fixed bottom-6 right-6 z-50">
          <GenioChat onClose={() => setOpen(false)} />
          <PreviewModal />
        </div>
      )}
    </>
  );
};
