"use client";

const LoadingSkeleton = () => {
  return (
    <div className="fixed inset-0 z-[9999] bg-white/80 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 space-y-10 animate-pulse">
      {/* Billboard Skeleton */}
      <div className="w-full max-w-6xl rounded-xl relative aspect-square md:aspect-[2.4/1] overflow-hidden bg-gray-300" />

      {/* Title Skeleton */}
      <div className="h-8 w-48 bg-gray-300 rounded" />

      {/* Employee Cards Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 w-full max-w-6xl">
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className="h-40 bg-gray-300 rounded-lg" />
        ))}
      </div>
    </div>
  );
};

export default LoadingSkeleton;
