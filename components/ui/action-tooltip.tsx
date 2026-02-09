"use client";

import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "./tooltip";

interface ActionTooltipProps {
  label: string;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  description?: string; // Added for longer hints
}

export const ActionTooltip = ({
  label,
  children,
  side = "top",
  align = "center",
  description
}: ActionTooltipProps) => {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}> {/* Slightly longer delay feels more intentional */}
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent 
          side={side} 
          align={align}
          className="bg-popover border-border shadow-md px-3 py-2 max-w-[260px] z-[110]"
        >
          <div className="flex flex-col gap-1">
            <p className="font-bold text-[12px] leading-none">
              {label}
            </p>
            {description && (
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};