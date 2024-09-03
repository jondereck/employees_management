"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { PuffLoader } from "react-spinners";

const loadingTexts = [
  "Analyzing HR data...",
  "Generating reports...",
  "Updating employee records...",
  "Optimizing HR processes...",
  "Managing workforce data...",
  "Securing HR data...",
];

const LoadingState = () => {
  const [loadingText, setLoadingText] = useState("Fetching employee profiles..."); // Initial loading text

  useEffect(() => {
    const interval = setInterval(() => {
      // Cycle through loading texts
      setLoadingText(prevText => {
        const currentIndex = loadingTexts.indexOf(prevText);
        const nextIndex = currentIndex === loadingTexts.length - 1 ? 0 : currentIndex + 1;
        return loadingTexts[nextIndex];
      });
    }, 1000); // Change text every second

    return () => clearInterval(interval); // Clean up interval on unmount
  }, []); // Empty dependency array ensures this effect runs only once

  return (
    <div className="h-full flex flex-col items-center justify-center gap-y-4">
      {/* <PuffLoader 
        size={100}
        color="red"
      /> */}

      <div className="w-10 h-10 animate-bounce">
        <Image
          fill
          alt="logo"
          src={'https://res.cloudinary.com/ddzjzrqrj/image/upload/v1720844539/hrps_logo_jfrcor.png'}
        />
      </div>
      <p className="text-white text-lg">{loadingText}</p>
    </div>
  );
}

export default LoadingState;
