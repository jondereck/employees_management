"use client";

import { ScanLine } from "lucide-react"; // White scanner-style icon
import { useEffect, useRef, useState } from "react";

const CameraScanner = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
    }, 100000);

    return () => clearTimeout(timer);
  },[]);


  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log("Scanned image:", file);
      // TODO: preview, OCR, or upload logic
    }
  };

  if(!visible) return null;

  return (
    <>
      {/* Hidden file input to trigger camera */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* Floating scanner icon button – only on mobile */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 sm:hidden">
        <button
          onClick={handleClick}
          className="bg-blue-600 hover:bg-blue-700 p-4 rounded-full shadow-xl transition-all"
        >
          <ScanLine className="h-6 w-6 text-white" />
        </button>
      </div>
    </>
  );
};

export default CameraScanner;
