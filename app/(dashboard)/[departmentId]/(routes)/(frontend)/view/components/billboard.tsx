"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { Billboard, Offices } from "../types";
import useLoadingStore from "@/hooks/use-loading";
import { motion } from "framer-motion";
import Loading from "@/components/loading-state";

interface BillboardProps {
  data: Billboard;
  offices: Offices | Billboard;
}

const Billboard: React.FC<BillboardProps> = ({ data, offices }) => {
  const isLoading = useLoadingStore((state) => state.isLoading);
  const displayText = (offices as Offices)?.name ?? data?.label;

  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isLoading) {
      setProgress(0);
      let current = 0;
      interval = setInterval(() => {
        current += 5;
        setProgress(current);
        if (current >= 95) clearInterval(interval);
      }, 100);
    } else {
      setProgress(100);
    }

    return () => clearInterval(interval);
  }, [isLoading]);

  return (
    <div className="relative">
      {isLoading && (
        <div className="absolute inset-0 z-50 bg-white/60 flex items-center justify-center">
          <Loading progress={progress} />
        </div>
      )}

      <div
        className={cn(
          "p-4 sm:p-6 lg:p-8 rounded-xl overflow-hidden",
          isLoading && "opacity-50 pointer-events-none select-none"
        )}
      >
        <div
          style={{ backgroundImage: `url(${data?.imageUrl})` }}
          className="aspect-square md:aspect-[2.4/1] bg-cover bg-center rounded-xl overflow-hidden group relative"
        >
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/10 z-0 flex justify-center items-center text-center p-4">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="font-bebas text-white text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold drop-shadow-2xl transition-transform duration-300 group-hover:scale-105 group-hover:text-emerald-400"
            >
              {displayText}
            </motion.h1>
          </div>

          {/* Optional ring border */}
          <div className="absolute inset-0 rounded-xl ring-2 ring-white/10 group-hover:ring-emerald-400/30 transition duration-300 z-0" />
        </div>
      </div>
    </div>
  );
};

export default Billboard;
