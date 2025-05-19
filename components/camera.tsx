"use client";

import { ScanLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";

const CameraScanner = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [qrResult, setQrResult] = useState<string | null>(null);


  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const img = new Image();
      img.src = reader.result as string;
      img.onload = async () => {
        try {
          const codeReader = new BrowserQRCodeReader();
          const result = await codeReader.decodeFromImageElement(img);
          const scannedText = result.getText();
          console.log("QR Code Result:", scannedText);
          setQrResult(scannedText);

          // ✅ Only open if URL starts with your domain
          if (scannedText.startsWith("https://hrps.vercel.app/")) {
            window.location.href = scannedText;
          } else {
            alert("Scanned QR code is not from a trusted source.");
          }

        } catch (error) {
          console.error("QR scan failed:", error);
          setQrResult("Failed to scan QR code");
        }
      };
    };
    reader.readAsDataURL(file);
  };





  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageUpload}
        className="hidden"
      />

      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 sm:hidden">
        <button
          onClick={handleClick}
          className="bg-blue-600 hover:bg-blue-700 p-4 rounded-full shadow-xl transition-all"
        >
          <ScanLine className="h-6 w-6 text-white" />
        </button>
      </div>

      {qrResult && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-white p-4 rounded-md shadow-md text-sm z-50">
          {qrResult}
        </div>
      )}
    </>
  );
};

export default CameraScanner;
