"use client";

import { useEffect, useState } from "react";
import LoadingState from "@/components/loading-state";

const Loading = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let value = 0;
    const interval = setInterval(() => {
      value += 5;
      setProgress(value);
      if (value >= 95) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval); // cleanup if unmounted
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white p-4">
      <LoadingState progress={progress} />
    </div>
  );
};

export default Loading;
