import Image from "next/image";
import { cn } from "@/lib/utils";

export default function BrandHeader() {
  return (
    <header className="w-full sticky top-0 z-50 bg-white/10 dark:bg-black/20 backdrop-blur-xl border-b border-white/20 dark:border-white/10 shadow-[0_2px_20px_rgba(0,0,0,0.02)]">
      <div className="mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Section */}
        <div className="flex items-center gap-3 min-w-0 group cursor-default">
          {/* Logo Container with Glass Effect */}
          <div className="relative p-1 rounded-xl bg-white/20 dark:bg-white/5 border border-white/30 dark:border-white/10 shadow-inner group-hover:scale-105 transition-transform duration-500">
             {/* Subtle liquid glow behind the seal */}
            <div className="absolute inset-0 bg-emerald-500/10 blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <Image
              src="/logo.png"
              alt="LGU Lingayen Seal"
              width={36}
              height={36}
              className="shrink-0 rounded-lg relative z-10"
              priority
            />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 dark:from-white dark:via-slate-200 dark:to-white truncate">
              Municipality of Lingayen
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400/70 truncate">
                Official Public Profile
              </p>
            </div>
          </div>
        </div>

        {/* Action Link with Floating Capsule Style */}
        <a 
          href="https://lingayen.gov.ph" 
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/20 transition-all hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]"
        >
          lingayen.gov.ph
        </a>
      </div>
    </header>
  );
}