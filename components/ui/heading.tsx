// components/ui/heading.tsx
import * as React from "react";
import { cn } from "@/lib/utils"; // Assuming you have a cn utility

interface HeadingProps {
  title: string | React.ReactNode;
  description?: string | React.ReactNode;
  className?: string;
}

const Heading = ({ title, description, className }: HeadingProps) => {
  return (
    <div className={cn("space-y-1", className)}>
      {/* Title with a subtle vertical gradient to simulate light hitting glass */}
      <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
        {title}
      </h2>
      
      {description != null && (
        <div className="flex items-center gap-2">
          {/* A small liquid accent line for visual flair */}
          <div className="h-1 w-1 rounded-full bg-emerald-500/50" />
          
          <p className="text-sm md:text-base font-medium text-slate-500/80 dark:text-slate-400/70 leading-relaxed">
            {description}
          </p>
        </div>
      )}
    </div>
  );
};

export default Heading;