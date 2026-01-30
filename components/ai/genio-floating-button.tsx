"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import clsx from "clsx";
import { IdleThinkingBubbles } from "./idle-thinking-bubble";

export function GenioFloatingButton({
  isThinking,
  onClick,
}: {
  isThinking: boolean;
  onClick: () => void;
}) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-2">
      {/* Container for thinking bubbles to ensure they stay centered above */}
      <div className="relative h-2 w-full flex justify-center">
        {isThinking && <IdleThinkingBubbles />}
      </div>

      <div className="relative group">
        {/* The Outer Glow/Ring */}
        <div className={clsx(
          "absolute -inset-0.5 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-75 blur-md transition duration-1000 group-hover:opacity-100 group-hover:duration-200",
          isThinking ? "animate-pulse" : "animate-none"
        )} />

        <Button
          variant="ghost"
          onClick={onClick}
          className={clsx(
            "relative h-16 w-16 rounded-full p-0 overflow-hidden border-white/20 shadow-2xl transition-transform active:scale-90 hover:scale-110",
            isThinking && "animate-genio-breath"
          )}
        >
          <Image
            src="/genio/genio-avatar.png"
            alt="Genio AI"
            fill
        
            priority
          />
        </Button>
      </div>
    </div>
  );
}