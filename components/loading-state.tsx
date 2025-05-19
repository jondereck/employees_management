"use client";




import { cn } from "@/lib/utils"; // Optional: for conditional class merging
import React from "react";

export default function LoadingSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center space-y-4 animate-pulse",
        className
      )}
    >
      {/* Logo or icon loader */}
      <div className="relative">
        <div className="h-16 w-16 rounded-full border-4 border-green-500 border-t-transparent animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center text-green-700 font-bold text-xl">
          <span className="animate-ping">•</span>
        </div>
      </div>

      {/* Text loading shimmer */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">Please wait...</p>
        <p className="mt-1 text-green-600 text-xs animate-pulse tracking-wide uppercase">
          Loading your next screen
        </p>
      </div>
    </div>
  );
}













// const LoadingSkeleton = () => {
//   return (
//     <div className="fixed inset-0 z-[9999] bg-white/80 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 space-y-10 animate-pulse">
//       {/* Billboard Skeleton */}
//       <div className="w-full max-w-6xl rounded-xl relative aspect-square md:aspect-[2.4/1] overflow-hidden bg-gray-300" />

//       {/* Title Skeleton */}
//       <div className="h-8 w-48 bg-gray-300 rounded" />

//       {/* Employee Cards Skeleton */}
//       <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 w-full max-w-6xl">
//         {Array.from({ length: 15 }).map((_, i) => (
//           <div key={i} className="h-40 bg-gray-300 rounded-lg" />
//         ))}
//       </div>
//     </div>
//   );
// };

// export default LoadingSkeleton;
