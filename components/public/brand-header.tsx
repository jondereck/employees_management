import Image from "next/image";
import { cn } from "@/lib/utils";

export default function BrandHeader() {
  return (
  <header className="w-full sticky top-0 z-50 bg-white/10 dark:bg-black/20 backdrop-blur-xl border-b border-white/20 dark:border-white/10 shadow-[0_2px_20px_rgba(0,0,0,0.02)]">
  <div className="mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:h-16 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">

    {/* Brand Section */}
    <div className="flex items-center gap-3 min-w-0 group cursor-default flex-1">

      {/* Logo */}
      <div className="relative p-1 rounded-xl bg-white/20 dark:bg-white/5 border border-white/30 dark:border-white/10 shadow-inner shrink-0 transition-transform duration-300 group-hover:scale-105">
        
        {/* Glow */}
        <div className="absolute inset-0 bg-[#DA1677]/10 blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />

        <Image
          src="/logo.png"
          alt="LGU Lingayen Seal"
          width={32}
          height={32}
          className="rounded-lg relative z-10 sm:w-9 sm:h-9"
          priority
        />
      </div>

      {/* Text */}
      <div className="min-w-0">
        <p className="text-xs sm:text-sm font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 dark:from-white dark:via-slate-200 dark:to-white truncate">
          Municipality of Lingayen
        </p>

        <div className="flex items-center gap-1.5 mt-0.5">
          <p className="text-[9px] sm:text-[10px] uppercase tracking-wide sm:tracking-widest font-bold text-slate-500 dark:text-slate-400/70 truncate">
            Official Public Profile
          </p>
        </div>
      </div>
    </div>

    {/* Action Link */}
    <a 
      href="https://lingayen.gov.ph" 
      target="_blank"
      rel="noopener noreferrer"
      className="shrink-0 px-3 py-1.5 rounded-full text-[9px] sm:text-[10px] md:text-xs font-bold uppercase tracking-wide sm:tracking-wider text-[#DA1677] bg-[#DA1677]/5 hover:bg-[#DA1677]/10 border border-[#DA1677]/20 transition-all hover:shadow-[0_0_15px_rgba(218,22,119,0.2)]"
    >
      lingayen.gov.ph
    </a>

  </div>
</header>

  );
}